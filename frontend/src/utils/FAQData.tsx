import chatWithDocImg from '../assets/Chat_with_document.png'
import chatWoDocDropdownImg from '../assets/Chat_wo_document_dropdown.png'
import chatWoDocImg from '../assets/Chat_wo_document.png'
import dropdownImg1 from '../assets/Dropdown_Image.png'
import dropdownImg2 from '../assets/Dropdown_Image_2.png'
import mygptChatSettingImg from '../assets/MyGPT_chat_setting.png'
import mygptUploadMenuImg from '../assets/MyGPT_upload_menu.png'

interface FAQItem {
	question: string;
	answer: string;
	image?: string | string[];
  }
  
  interface FAQData {
	[key: string]: FAQItem[];
  }
  

  export const faq :FAQData ={
	"Asking Questions" : [
        {
	    "question": "1. What kind of questions can I ask MyGPT?",
	    "answer": "During MyGPT evaluation, we have used six different question types as follows: <br/>• <b>Keyword search:</b> An acronym or a definition from the papers.For example, 'What is acetyl-CoA?' <br/><b>• Summarization:</b> Question that summarize a topic or method. For example, 'What is the proof that pathogenic gain-of-function mutations can shift the equilibrium towards the active state in FGFRs?'<br/> <b>• Yes/no: </b>The answer can be a simple yes or no. For example, 'Does the regulatory domain inhibit the PAK4 kinase activity?' <br/> <b>• Data query: </b>Question to find data or other facts from a section or information from several papers. For example, 'Where are the leukemia-related breakpoints located in CBP/p300?'<br/> <b>• Complex question:</b> A research question to collect information from different parts of a paper and synthesize a response. For example, “What are the biggest issues facing the development of better CAR-T therapies? Rank them in order of difficulty and provide examples with citations on all potential strategies to overcome these limitations. </br> <b>• Irrelevant question: </b>A question about a topic that is not covered by the publication library. For example, asking questions about Harry Potter to a library of GPCR documents: “What does Hagrid give Harry as a Christmas present?”.  </br>  You can also ask questions that do not follow the above categories, and MyGPT will answer  them if they are within the limits of LLMs and RAG concepts. Several tasks, such as  performing statistical analysis, analyzing whole documents, or listing references from  literature with high accuracy, are beyond the current capability of LLMs and MyGPT"
    	},
		{
			"question": "2. Can I ask any questions about topics from my library?",
			"answer": "You can ask questions that can be answered using the information available within your document library. If the data is missing from the documents, MyGPT will not be able to answer it or will let you know that the information is missing from your papers."
		},
		{
			"question": "3. Can I ask a question about information that is in tables or figures in the library documents?",
			"answer": " MyGPT will read tables as text and try to use that information to answer your question. However, it will not be able to parse the table and find the relationship between table  columns and information from the table. Also, MyGPT will not perform statistical analysis for data present in the table. MyGPT can’t find information from the figures if it can only be answered by interpreting it or by performing the statistical analysis, although it will be able toread the legend of the figure. If the question can be answered using the legend, it can answer it."
		}
	],
	"MyGPT answers" : [
		{
			"question":" 1. What information does MyGPT uses to answer my question?",
			"answer": "MyGPT uses information in the documents in your library as the primary source of  information. If the information is missing from the library, MyGPT will use inherent knowledge of LLM, which was used for the training phase of specific LLM."
		},
		{
			"question": "2. Is MyGPT using the internet to answer my question?",
			"answer": "MyGPT does not use the internet or any external API services to get information to answer your question"
		},
		{
			"question": "3. Can I use MyGPT to chat with LLM without incorporating documents pipeline (RAG), like ChatGPT?",
			"answer": "You can use MyGPT to chat directly with LLM without the RAG pipeline. At the top of the Chat panel, you can use the drop-down to switch from \"Chat with Documents\" to \"Direct chat with GPTs\". In this case, MyGPT will use LLM’s inherent knowledge to answer users' questions.",
		    "image": [chatWithDocImg, chatWoDocDropdownImg, chatWoDocImg]
		},
		{
		   "question": "4. What happens if the information to answer the question is not available in my library?",
			"answer": "If the information needed to answer the question is unavailable in your library, MyGPT will either acknowledge that it is missing from the library or, in rare cases, use the LLM’s inherent knowledge to answer it. It will also provide confidence matrices in the form of question relevance score (QRS), answer relevance score (ARS), and hallucination index (HI). Low QRS, QRS, and high HI should be interpreted as an indication to verify and cross-reference the generated answer with the retrieved context highlighted in the documents. Suppose the question is off-topic from the subjects covered in the papers. In that case, the QRS and ARS scores will be low, and HI will be high, indicating that the generated answer does not use any information from the document and is entirely generated using the LLM's inherent knowledge."
		},
		{
			"question": "5. If I am certain my library has the necessary information to answer the question, but MyGPT is not able to find it, what should I do?",
			"answer": "We recommend several solutions if you are sure that the documents contain the information  to answer the question:<br><br><ol><li><b>1.</b> The first thing to try is rephrasing it and providing more context with your question if it’s  too short.</li><li><b>2.</b> You can also adjust QRS and ARS cut-off values from the customizations. Certain words in embedding models have a higher distance than our perceived understanding of  language as the specific domain knowledge was lacking in training of embedding  models. Increasing the QCworst and Aworst values can aid in finding the correct context from documents. </li><li><b>3.</b>        We have also observed different embedding models provide different meanings to the  same library of documents.</li></ol><br> So, if rephrasing and adjusting relevance scores doesn’t  work, we recommend creating the same library with a different embedding model."	
		},
		{
			"question": "6. What happens if the information to answer the question is contained in a figure or table?",
			"answer": "MyGPT will read tables as text and try to use that information to answer your question. However, it will not be able to parse the table and find the relationship between table column names and the data from the table. Also, MyGPT will not perform statistical analysis for data  present in the table. MyGPT will be able to read the legend of the figure. If the question can  be answered using the legend, it can answer it. However, if your question can only be  answered by interpreting the figure or by comparing data present in your figure, MyGPT will  not be able to answer it."
		},
		{
			"question": "7. If there is information on my library that is outdated or inconsistent with public information  available on the internetfacts available in public domain, will MyGPT detect the inconsistency?",
			"answer": "MyGPT is designed to perform question-answering in the context of your library of documents and will hold the information from your documents as the highest truth. If the  information in your document is outdated compared to facts in the public domain, MyGPT will answer them using only information from your documents. If the LLM has more up-to-date information about your question, the answer relevance score (ARS) and hallucination  index (HI) may be able to guide you. MyGPT also provides answers generated without the  RAG pipeline as the drop-down with the original MyGPT-generated answers. You can  compare that answer with an original answer to verify the discrepancy in relevance scores.  However, if the most up-to-date information about your topic is also missing from LLM training data, MyGPT will answer it only using information from your documents",
		    "image": [dropdownImg1, dropdownImg2]
		},
		{
			"question": "8. If the answer is related to up-to-date information that is contained in my library but that was missing from the training data used for the LLM being used, will MyGPT be able to answer accurately?",
			"answer": "Yes, MyGPT uses the facts present in your documents as the highest truth and will be able to  use them as context to answer your question. MyGPT does not rely on LLM training data and eliminates the need for periodic retraining of LLMs with new information"
		},
	],
	'Confidence Metrics': [
		{
			"question": "14. What are confidence metrics?",
			"answer": "Confidence metrics are quantitative scores used by MyGPT to gauge answer trustworthiness.<br/><br/><b>QRS (Question Relevance Score)</b> measures how well a question matches the document library.<br/><b>ARS (Answer Relevance Score)</b> measures how well the answer is grounded in retrieved passages.<br/><b>HI (Hallucination Index)</b> indicates potential hallucination risk when QRS/ARS are low.<br/><br/>Together, these metrics help users verify whether an answer is document-supported or may need cross-checking."
		},
		{
			"question": "15. How are question relevance scores (QRS) and answer relevance scores (ARS) calculated, and how to interpret them?",
			"answer": "QRS and ARS are weighted combinations of semantic, keyword (BM25), and rerank components across top-k retrieved chunks.<br/><br/><b>QRS</b> = (a &times; (&Sigma;<sub>i=1</sub><sup>k</sup> Q<sub>sem,i</sub>/k)) + (b &times; (&Sigma;<sub>i=1</sub><sup>k</sup> Q<sub>key,i</sub>/k)) + (c &times; (&Sigma;<sub>i=1</sub><sup>k</sup> Q<sub>rerank,i</sub>/k))<br/><b>ARS</b> = (x &times; (&Sigma;<sub>i=1</sub><sup>k</sup> A<sub>sem,i</sub>/k)) + (y &times; (&Sigma;<sub>i=1</sub><sup>k</sup> A<sub>key,i</sub>/k)) + (z &times; (&Sigma;<sub>i=1</sub><sup>k</sup> A<sub>rerank,i</sub>/k))<br/><br/>Interpretation:<br/>- High QRS: question is likely well matched to the library.<br/>- Low QRS: information may be missing or weakly matched.<br/>- High ARS: answer is grounded in retrieved context.<br/>- Low ARS: answer may rely less on retrieved evidence."
		},
		{
			"question": "16. How is the hallucination index (HI) calculated, and how to interpret it?",
			"answer": "HI combines QRS and ARS into a single risk score:<br/><br/><b>HI</b> = 1 - ((p &times; QRS)/(p + q)) - ((q &times; ARS)/(p + q))<br/><br/>where p and q are weighting factors from sensitivity analysis.<br/><br/>- Low HI (near 0): answer is likely grounded in library evidence.<br/>- High HI (near 1): higher chance the answer depends on model priors rather than retrieved context."
		},
		{
			"question": "17. Can I change the calculations of QRS, ARS, and HI?",
			"answer": "Yes. The default formulas and weights are provided in the paper/software, but they are not the only option. You can tune the QRS weights (a,b,c), ARS weights (x,y,z), and related thresholds from chat settings, or re-run optimization on your own dataset.",
			"image": mygptChatSettingImg
		},
		{
			"question": "18. I am asking a question, and it is about a topic in the library, but it gives me 0% relevance. Is it possible to relax the cutoff values for QRS?",
			"answer": "Yes. You can improve retrieval by:<br/><br/>1. Rephrasing the question with more specific context.<br/>2. Adjusting retrieval thresholds/weights (including QRS-related settings) from MyGPT settings.<br/>3. Trying a different embedding model that better captures your domain terminology.<br/><br/>If relevance still stays at 0% after these steps, the required information may not exist in the current library."
		}
	],
	'Library Creation': [
		{
			"question": "19. What are the options for creating a library?",
			"answer": "MyGPT supports two main approaches:<br/><br/><b>1) Direct upload through MyGPT</b><br/>- Simple upload with default preprocessing.<br/>- Advanced setup for chunking, overlap, embedding model, distance function, BM25, reranker, and retrieval parameters.<br/><br/><b>2) Import from a Zotero collection</b><br/>- Pull a private/shared Zotero collection into a MyGPT dataset using the Zotero integration/API.<br/><br/>Both options create a searchable library for RAG queries."
		},
		{
			"question": "20. What document types are supported by MyGPT?",
			"answer": "MyGPT supports PDF, DOC/DOCX, and TXT files. It extracts text from supported files but does not answer from image-only content in those files."
		},
		{
			"question": "21. What is the library size limit supported by MyGPT?",
			"answer": "Based on tested limits, MyGPT supports up to 10 GB total upload size and up to 10,000 files. Large libraries mainly impact upload/preprocessing time; retrieval and generation remain efficient after indexing."
		},
		{
			"question": "22. How much time does it take to upload a library?",
			"answer": "Upload time depends on hardware and document volume. Small libraries can upload in seconds to minutes, while large collections (for example, thousands of pages) can take much longer. Faster GPUs significantly reduce upload and processing time."
		},
		{
			"question": "23. How should I format my document library?",
			"answer": "Use clean, text-extractable documents. MyGPT works well with biomedical literature, SOPs, and policy documents. Avoid scanned photocopies because MyGPT does not include OCR for image-only scans."
		},
		{
			"question": "24. Can MyGPT help me with library creation, management, or library expansion related to topics covered by the library?",
			"answer": "MyGPT does not automatically build or expand libraries for you. Users collect and manage source documents externally (for example with Zotero or EndNote), then import/upload into MyGPT."
		},
		{
			"question": "25. If a library is shared with other users, can they see my chat history?",
			"answer": "Yes. Chat history is tied to the library. For shared/public libraries, users with access can view the history. For private libraries, only the owner/account with access can view it."
		},
		{
			"question": "26. If I delete the library, will it delete chat history as well?",
			"answer": "Yes. Deleting a library removes its uploaded documents, vectors/embeddings, tokenizer artifacts, and associated chat history from the backend database."
		}
	],
	'Installation': [
		{
			"question": "27. What are the options for installing and using MyGPT?",
			"answer": "MyGPT can be installed on:<br/>- Personal computer<br/>- Server/VM with GPU<br/>- Cloud services (Azure example)<br/><br/>Personal computer setup uses Ollama and needs at least 8 GB RAM (16 GB recommended) and about 10 GB disk space. Direct Ollama install is available on macOS/Linux; Windows can use Docker."
		},
		{
			"question": "28. What is the minimum requirement for installing MyGPT on a laptop?",
			"answer": "Baseline requirements:<br/>- CPU: 8 cores or more<br/>- RAM: 16 GB recommended (pipeline can run at 8 GB)<br/>- GPU: required for practical LLM inference via Ollama<br/>- Storage: around 10 GB free"
		},
		{
			"question": "29. How can I check if my computer/laptop is powerful enough to use MyGPT?",
			"answer": "Key bottlenecks are GPU and RAM. Run a representative Ollama generation request multiple times and compare latency (first run is usually slower due to model loading). If responses consistently take very long (for example, over a minute), local resources may be insufficient."
		},
		{
			"question": "30. Is there any advantage to using MyGPT when installing it on my computer?",
			"answer": "Yes. Local installation provides strong privacy, offline operation, simpler control over model/retrieval settings, and lower dependency on external services. It is practical for users who need secure, customizable RAG workflows."
		},
		{
			"question": "31. Is there any advantage of using MyGPT by installing it on the server?",
			"answer": "Yes. Server deployment supports centralized secure access, shared GPU resources for teams, easier maintenance/updates, and often better performance than individual laptops. It can also reduce overall cost in multi-user environments."
		},
		{
			"question": "32. How much will it cost to host MyGPT on the cloud with minimum requirements cost?",
			"answer": "Cloud cost depends on provider, VM type, and GPU class. Example estimates in the documentation range from a few hundred USD/month for T4/L4-class setups to around a few thousand USD/month for A100-class infrastructure."
		},
		{
			"question": "33. Is it possible to reduce hosting cost by sharing any infrastructure of MyGPT without compromising privacy?",
			"answer": "Yes. Ollama can be shared across multiple MyGPT instances/applications. Since chats/PDFs are not stored in the LLM server itself, sharing this layer can reduce cost without exposing document data."
		},
		{
			"question": "34. Where are the PDFs I have uploaded located?",
			"answer": "Uploaded PDFs are stored locally on the machine/server running MyGPT. Documents are split into chunks, embedded, and indexed in the local vector database for retrieval."
		},
		{
			"question": "35. Does MyGPT send any data to any external services or APIs?",
			"answer": "No. MyGPT is designed to run locally and does not send chat/document data to external API services. Embeddings and retrieval data are handled within local components."
		},
		{
			"question": "36. Does MyGPT work offline?",
			"answer": "Yes. MyGPT supports offline operation with local models and local retrieval infrastructure, making it suitable for private, restricted, or air-gapped environments."
		}
	],
	'Customization': [
		{
			"question": "37. Which LLMs can I use with MyGPT?",
			"answer": "MyGPT can run open-source LLMs available through Ollama/CLI. Typical options include smaller edge-friendly models, mid-range models, and large server/cloud models. You can switch models from the UI for RAG or direct chat workflows."
		},
		{
			"question": "38. Can I use OpenAI, Claude, or Gemini LLMs with MyGPT?",
			"answer": "MyGPT is built for fully local/offline execution and does not directly call external commercial LLM APIs such as OpenAI, Claude, or Gemini."
		},
		{
			"question": "39. Which are the embedding models I can use with MyGPT?",
			"answer": "MyGPT supports open-source embedding models from Hugging Face/Ollama. Common options include nomic-embed-text (default), nomic-embed-text-v2-moe, bge-m3, paraphrase-multilingual variants, multi-qa-MiniLM-L6-cos-v1, and MedCPT for biomedical contexts."
		},
		{
			"question": "40. What are the customizations offered by MyGPT?",
			"answer": "MyGPT is modular and configurable across the full pipeline:<br/>- Preprocessing/chunking strategy and overlap<br/>- Embedding model and retrieval distance function<br/>- Vector/keyword search settings<br/>- Reranker and relevance scoring options<br/>- LLM choice and creativity controls (temperature, top-k/p)<br/>- Context protocol and transparency settings (QRS/ARS/HI with citations)",
			"image": [mygptUploadMenuImg, mygptChatSettingImg]
		},
		{
			"question": "41. Can you suggest any ideal customizations for MyGPT?",
			"answer": "Recommended baseline:<br/>1) Choose a strong LLM for your hardware tier.<br/>2) Use a high-performing embedding model (for example nomic-embedding-text).<br/>3) Keep BM25 enabled for keyword-heavy queries.<br/>4) Start with fixed-size chunking (~1000 chars) and overlap.<br/>5) Tune QRS/ARS thresholds for recall vs precision.<br/>6) Enable reranking (or multilingual reranker when needed).<br/>7) Set creativity low for factual QA and higher for brainstorming."
		}
	],
	'General developers': [
		{
			"question": "42. Is there documentation on APIs available from MyGPT?",
			"answer": "Yes. API documentation is available at https://github.com/stjude/MyGPT/blob/main/development.md and includes endpoint purposes, required request keys, and response fields for common operations such as document retrieval, RAG context retrieval, and answer persistence."
		},
		{
			"question": "43. How do I report a bug or feature for MyGPT?",
			"answer": "Please report bugs and feature requests in the project issues tracker: https://github.com/mb-group/MyGPT_public/issues"
		},
		{
			"question": "44. How can I contribute to the development of MyGPT?",
			"answer": "If you want to contribute or request source access for development collaboration, contact Jaimin Patel (jaimin.patel@stjude.org) or the appropriate representative at St. Jude Children's Research Hospital."
		}
	]
 
  }