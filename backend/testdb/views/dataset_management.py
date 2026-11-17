"""
Dataset management functions
"""
import os
import re
import datetime
import pymupdf
import pandas as pd
from django.core.files.base import File
from django.utils.timezone import make_aware
from langchain.text_splitter import RecursiveCharacterTextSplitter
from tqdm import tqdm
import chromadb

from ..models import Papers, Dataset, Question, Answer, Conversation, PaperSections
from .document_processing import getPDFContent, convert_to_pdf, get_toc_from_grobid
from .helpers import safe_path, sanitize_filename, validate_dataset_name
from .embedding_utils import get_embedding_model_ef
from .analytics import add_pca_to_chunks


def add_dataset_from_upload(request, progress_callback=None):
    """Create dataset from uploaded files"""
    dataset_name_r = request.POST.get('dataset_name').replace(' ', '_')
    paper_titles_r = request.POST.getlist('paper_title')
    paper_attachments = request.FILES.getlist('paper_attachment')
    user_r = request.POST.get('user')
    user_email_r = request.POST.get('user_email')
    user_group_r = request.POST.get('user_group')
    use_overlap = request.POST.get('use_overlap')
    chunking_method = request.POST.get('chunking_method')
    chunk_size = request.POST.get('chunk_size')
    distance_function_r = request.POST.get('distance_function')
    use_bm25 = request.POST.get('use_bm25')
    reranker_r = request.POST.get('reranker')
    language_of_docs_r = request.POST.get('documents_language')
    use_reranker = False if reranker_r == 'None' else True
    default_prompt = '###INSTUCTIONS#### \nUse following information to answer the question in less than 200 words, try not to use any other information other than provided context. if the information is not in the context, then tell user that information is not found in the documents.\n ### CONTEXT ####'

    try:
        dataset_name = validate_dataset_name(dataset_name_r)
    except ValueError:
        return False

    paper_titles = paper_titles_r

    # Validate user input
    if not user_r or not re.match(r'^[a-zA-Z0-9_\-]+$', user_r):
        return False
    else:
        user = user_r

    # Validate user_email input
    if not user_email_r or not re.match(r'^[a-zA-Z0-9_\-@.]+$', user_email_r):
        return False
    else:
        user_email = user_email_r

    # Validate user_group input
    if not user_group_r or not re.match(r'^[a-zA-Z0-9_\-]+$', user_group_r):
        return False
    else:
        user_group = user_group_r 

    # Validate distance_function input
    if not distance_function_r or not re.match(r'^[a-zA-Z0-9_\-]+$', distance_function_r):
        return False
    else:
        distance_function = distance_function_r

    # Validate language_of_docs input
    if not language_of_docs_r or not re.match(r'^[a-zA-Z]+$', language_of_docs_r):
        return False
    else:
        language_of_docs = language_of_docs_r.lower()

    use_overlap = True if use_overlap == 'Yes' else False
    chunk_size = int(chunk_size)

    print(f'Sentence Transformer: {request.POST.get("embedding_model")}')
    print(f'Chunk Size: {chunk_size}')
    print(f'Use Overlap: {use_overlap}')
    overlap_size = int(0.2 * chunk_size) if use_overlap else 0
    print(f'Overlap Size: {overlap_size}')

    # create dataset
    dataset = Dataset.objects.filter(dataset_name=dataset_name)
    if dataset.count() > 0:
        dataset = dataset[0]
    else:
        dataset = Dataset.objects.create(
            dataset_name=dataset_name,
            library_type='papers',
            dataset_size=0,
            chunksize=chunk_size,
            chunking_method=chunking_method,
            overlap=use_overlap,
            use_bm25= True if use_bm25 == 'Yes' else False,
            use_reranker=use_reranker,
            reranker=reranker_r,
            documents_language=language_of_docs,
            distance_function=distance_function,
            user = user if len(user) else '-',
            dataset_prompt = default_prompt,
            user_email = user_email if len(user_email) else '-',
            user_group = user_group if len(user_group) else '-',
            dataset_date_time=make_aware(datetime.datetime.now()),
            direct_chat_without_docs = False
        )

    # make directory for pdfs
    dataset_directory = safe_path('data/pdfs', dataset_name)
    dataset_directory.mkdir(parents=True, exist_ok=True)
    
    # save pdfs
    data = []
    valid_files = [title for title in paper_titles if title and title != '-']
    total_files = len(valid_files)
    file_count = 0
    
    for idx in range(len(paper_titles)):
        if paper_titles[idx] == '' or paper_titles[idx] == '-':
            continue
        
        file_count += 1
        progress_percent = 10 + int((file_count / total_files) * 15) if total_files > 0 else 10
        if progress_callback:
            progress_callback('uploading', progress_percent, f'Processing file {file_count}/{total_files}')
        paper = Papers.objects.create(
            paper_title=paper_titles[idx],
            paper_dataset=dataset,
            paper_date_time=make_aware(datetime.datetime.now())
        )
        attachment = paper_attachments[idx]
        # check for path traversal
        if '/' in attachment.name:
            return False

        if not dataset_directory.exists():
            return False
        doctype = '.' + attachment.name.split('.')[-1]
        base_name = os.fspath(safe_path(dataset_directory, 'paper' + str(idx+1)))

        # Ensure the file extension is valid
        allowed_extensions = ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls', '.csv']
        if doctype.lower() not in allowed_extensions:
            raise ValueError("Invalid file extension")

        if doctype.lower() in ['.xlsx', '.xls', '.csv']:
            # sanitize base_name and doctype
            base_name = sanitize_filename(base_name)
            doctype = sanitize_filename(doctype)

            with open(base_name + doctype, 'wb') as f:
                f.write(attachment.read())

            if doctype in ['.xlsx', '.xls']:
                df = pd.read_excel(base_name + doctype)
            elif doctype == '.csv':
                df = pd.read_csv(base_name + doctype)
            df.dropna(axis = 0, how = 'all', inplace = True)

            # Build fixed-width text lines for the table
            col_widths = [
                min(max(len(str(col)), int(df[col].astype(str).str.len().max())), 40)
                for col in df.columns
            ]
            rows = [df.columns.tolist()] + df.astype(str).values.tolist()
            text_lines = []
            for row in rows:
                line = '  '.join(str(cell)[:w].ljust(w) for cell, w in zip(row, col_widths))
                text_lines.append(line)

            # Write paginated PDF using pymupdf (A4 landscape)
            doc = pymupdf.open()
            lines_per_page = 75
            for page_start in range(0, len(text_lines), lines_per_page):
                page = doc.new_page(width=842, height=595)
                page.insert_text(
                    (20, 20),
                    '\n'.join(text_lines[page_start:page_start + lines_per_page]),
                    fontsize=7,
                    fontname='courier',
                )
            doc.save(base_name + '.pdf')
            doc.close()

            with open(base_name + '.pdf', 'rb') as f:
                paper.paper_attachment.save(dataset_name + '/paper' + str(idx+1) + '.pdf', File(f), save=True)

            fulltext = str(df.to_json(orient='records'))
            fulltext_chunk = {'title': paper_titles[idx], 'page': 1, 'content': fulltext, 'type': 'spreadsheet_full'}
            data.append(fulltext_chunk)

            for i, row in df.iterrows():
                doc_info = row.to_string(header=True)
                doc_info = ','.join(doc_info.split('\n'))
                doc_info = ': '.join(re.split(r'\s+', doc_info))
                doc_info = ', '.join(doc_info.split(','))

                chunk = {'title': paper_titles[idx], 'page': i, 'content': doc_info, 'type': 'spreadsheet_chunk'}
                data.append(chunk)
            
        else:
            # sanitize base_name and doctype
            base_name = sanitize_filename(base_name)
            doctype = sanitize_filename(doctype)

            pdf_name = base_name + '.pdf'
            with open(base_name + doctype.lower(), 'wb') as f:
                f.write(attachment.read())
            
            if doctype.lower() != '.pdf':
                convert_to_pdf(base_name + doctype.lower(), base_name.removesuffix(f'/paper{str(idx+1)}'))

            with open(pdf_name, 'rb') as f:
                paper.paper_attachment.save(dataset_name + '/paper' + str(idx+1) + '.pdf', File(f), save=True)

            if chunking_method == 'fixed_chunk_size':        
                pages = getPDFContent(pdf_name)

                for page_num, page in enumerate(pages):
                    text = page.extract_text()
                    n = chunk_size
                    splits = []
                    remainder = ''
                    for i in range(0, len(text), n - overlap_size):
                        item = remainder + text[i : i + n]
                        item = ' '.join(item.split())
                        if '. ' in item and not use_overlap:
                            remainder = item.split('. ')[-1]
                            item = item.removesuffix(remainder)
                        if len(item) > 10:
                            splits.append(item)
                    for split in splits:
                        chunk = {'title': paper_titles[idx], 'page': page_num+1, 'content': split, 'type': 'pagechunk'}
                        data.append(chunk)
            elif chunking_method == 'structure_preserving':
                doc = pymupdf.Document(pdf_name)
                # get table of contents
                toc = doc.get_toc(simple=True)
                # if toc is empty, use grobid to get the table of contents
                if len(toc) == 0:
                    toc = get_toc_from_grobid(pdf_name)
                final_section_titles = []
                section_title = ''
                previous_section_title = ''

                #  filter toc till levels 2 only
                toc_filter = [item for item in toc if item[0] <= 2]

                for page in doc:
                    splitter = RecursiveCharacterTextSplitter(
                        chunk_size=chunk_size,
                        chunk_overlap=int(0.2 * chunk_size) if use_overlap else 0,
                        separators=["\n\n", "\n", ".", " "],
                        length_function=len
                    )
                    # get text from page
                    page_text = page.get_text("text")
                    raw_chunks = splitter.create_documents([page_text])

                    chunks = []
                    for i, chunk in enumerate(raw_chunks):
                        chunks.append({
                            "chunk_id": i,
                            "text": chunk.page_content.strip(),
                            "metadata": {
                                "source_pdf": pdf_name
                            }
                        })

                    page_sections = []
                    for toc_item in toc_filter:
                        if toc_item[2] == page.number + 1:
                            section_title = toc_item[1].strip().replace('\r', '')
                            page_sections.append(section_title)
                    
                    if len(page_sections) == 0 and previous_section_title == '':
                        previous_section_title = 'Abstract/Introduction'
                    elif len(page_sections) != 0:
                        previous_section_title = page_sections[len(page_sections) - 1]
                    
                    for chunk in chunks:
                        chunk_text = chunk['text'].strip()
                        for section in page_sections:
                            if section in chunk_text:
                                section_title = section
                                break
                        if section_title == '' and previous_section_title != '':
                            section_title = previous_section_title
                        elif section_title == '' and len(page_sections) != 0:
                            section_title = 'Abstract/Introduction'
                    
                        if len(chunk_text) > 10:
                            if section in chunk_text:
                                chunks = chunk_text.split(section)
                                # find previous entry before section in page_sections otherwise use previous_section_title
                                section_index = page_sections.index(section) if section in page_sections else -1 
                                if section_index > 0:
                                    previous_section_title = page_sections[section_index - 1]
                                elif section_index == 0 and previous_section_title != '':
                                    previous_section_title = previous_section_title
                                else:
                                    previous_section_title = 'Abstract/Introduction'
                                if len(chunks[0]) > 10:
                                    chunk_1 = {'title': paper_titles[idx], 'page': page.number + 1, 'content': chunks[0].strip(), 'section': previous_section_title, 'type': 'pagechunk'}
                                    data.append(chunk_1)
                                if len(chunks[1]) > 10:
                                    chunks_2 = {'title': paper_titles[idx], 'page': page.number + 1, 'content': chunks[1].strip(), 'section': section_title, 'type': 'pagechunk'}
                                    data.append(chunks_2)
                            else:
                                chunk = {'title': paper_titles[idx], 'page': page.number + 1, 'content': chunk_text, 'section': section_title, 'type': 'pagechunk'}
                                data.append(chunk)
                            if section_title not in final_section_titles:
                                final_section_titles.append(section_title)     

                # save sections to database
                for section_title in set(final_section_titles):
                    count = 1
                    section_obj = PaperSections.objects.filter(section_title=section_title, section_dataset=dataset)
                    if section_obj.count() > 0:
                        count = section_obj[0].section_count
                        section_obj = section_obj[0]
                        section_obj.section_count += count
                        # section_obj.save()
                    else:
                        PaperSections.objects.create(
                            section_title=section_title,
                            section_count=count,
                            section_dataset=dataset
                        )                         

    chunks_path = safe_path('data/data_chunks', dataset_name + '.txt')
    with chunks_path.open('w') as f:
        for chunk in data:
            f.write(str(chunk) + '\n')

    return dataset_name


def add_demo_dataset(embedding_model_request='multi-qa-MiniLM-L6-cos-v1'):
    """Add demo GPCR dataset"""
    documents_directory = '/code/data'
    documents = []
    metadatas = []
    dataset_name = 'MyGPT'
    titles = []
    client = chromadb.PersistentClient(path='/code/chroma_storage/.')

    embedding_model_ef = get_embedding_model_ef(embedding_model_request)

    # If the collection already exists, we will delete it and create a new one.
    if len(client.list_collections()):
        for collection in client.list_collections():
            if collection.name == dataset_name:
                client.delete_collection(name=dataset_name)
    collection = client.get_or_create_collection(name=dataset_name, embedding_function=embedding_model_ef)

    # Create ids from the current count
    count = collection.count()
    print(f'Collection already contains {count} documents')

    # Load the documents in batches of 100
    if count == 0:
        with open(f'{documents_directory}/data_chunks/MyGPT.txt', 'r') as file:
            for line_number, line in enumerate(
                tqdm((file.readlines()), desc=f'Reading MyGPT.txt'), 1
            ):
                # Strip whitespace and append the line to the documents list
                line = line.strip()
                #convert line to json
                line_json = eval(line)
                documents.append(line_json['content'])
                metadatas.append({'filename': line_json['title'], 'page': line_json['page'], 'type': line_json['type']})
                if line_json['title'] not in titles:
                    titles.append(line_json['title'])
        ids = [str(i) for i in range(count, count + len(documents))]
       
        for i in tqdm(
            range(0, len(documents), 100), desc='Adding documents', unit_scale=100
        ):  
            try:
                collection.add(
                    ids=ids[i : i + 100],
                    documents=documents[i : i + 100],
                    metadatas=metadatas[i : i + 100],  # type: ignore
                )
            except:
                print('error adding documents')

        new_count = 0
        try:
            new_count = collection.count()
        except:
            print('error counting documents')
        
        print(f'new_count: {new_count}')
        dataset = Dataset.objects.create(
            dataset_name=dataset_name,
            library_type='papers',
            dataset_size=new_count,
            embedding_model=embedding_model_request,
            chunksize=1000,
            chunking_method='fixed_chunk_size',
            overlap=True,
            use_bm25=False,
            distance_function='l2',
            dataset_date_time=make_aware(datetime.datetime.now()),
            user='-',
            user_email='-',
            user_group='user',
            documents_language='english',
            dataset_prompt='###INSTUCTIONS#### \nUse following information to answer the question in less than 200 words, try not to use any other information other than provided context. if the information is not in the context, then tell user that information is not found in the documents.\n ### CONTEXT ####'
        )

        for (idx, title) in enumerate(titles):
            paper = Papers.objects.create(
                paper_title=title,
                paper_dataset=dataset,
                paper_date_time=make_aware(datetime.datetime.now())
            )
            with open(f'{documents_directory}/pdfs/{dataset_name}/paper{idx+1}.pdf', 'rb') as f:
                paper.paper_attachment.save(dataset_name + '/paper' + str(idx+1) + '.pdf', File(f), save=True)

        # add pca to chunks
        add_pca_to_chunks()
           
        print(f'Added {new_count - count} documents')


def get_conversation_json(question_text):
    """Get conversation history as JSON"""
    conversation_id = Question.objects.filter(question_text=question_text)[0].conversation.id
    conversation = Conversation.objects.get(id=conversation_id)
    questions = Question.objects.filter(conversation=conversation).order_by('saved_date_time')
    conversation_json = []
    for question in questions:
        answers = Answer.objects.filter(question=question)
        qna_json = {
            'question': question.question_text,
            'answers': answers[0].answer_text,
        }
        conversation_json.append(qna_json)
    return conversation_json


def get_previous_qna_json(question_text):
    """Get previous Q&A as JSON"""
    question = Question.objects.filter(question_text=question_text)[0]
    answers = Answer.objects.filter(question=question)
    conversation_json = []
    qna_json = {
        'question': question.question_text,
        'answers': answers[0].answer_text,
    }
    conversation_json.append(qna_json)
    return conversation_json