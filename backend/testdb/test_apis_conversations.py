from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from testdb.models import Answer, Conversation, Dataset, Model, Question, Source


class ConversationAndAnswerAPITests(TestCase):
	def setUp(self):
		self.dataset = Dataset.objects.create(dataset_name='My Library')
		self.model = Model.objects.create(model_name='llama3:latest')
		self.conversation = Conversation.objects.create(conversation_dataset=self.dataset)
		self.question = Question.objects.create(
			question_text='What is MyGPT?', model_type=self.model,
			question_dataset=self.dataset, conversation=self.conversation,
			semantic_score=66.0, keyword_score=0.0, rerank_score=98.0,
		)

	def test_get_conversations_omits_questions_without_answers(self):
		Answer.objects.create(
			answer_text='A research assistant', question=self.question, model_type=self.model,
			relevance_score=97.0, semantic_score=67.7, keyword_score=0.0, rerank_score=91.2,
		)
		unanswered = Question.objects.create(
			question_text='Unanswered', model_type=self.model,
			question_dataset=self.dataset, conversation=self.conversation,
		)

		response = APIClient().get(reverse('conversation_history'), {'dataset': self.dataset.dataset_name})

		self.assertEqual(response.status_code, 200)
		items = response.json()['conversations'][0]['questions_answers']
		self.assertEqual([item['question'] for item in items], ['What is MyGPT?'])
		self.assertNotIn(unanswered.question_text, [item['question'] for item in items])

	def test_get_question_details_returns_answers_and_source_color(self):
		Answer.objects.create(
			answer_text='A research assistant', question=self.question, model_type=self.model,
			relevance_score=97.0, semantic_score=67.7, keyword_score=0.0, rerank_score=91.2,
		)
		Source.objects.create(
			source_doc='paper.pdf', source_pointer=2, context='source text',
			vector_score=0.7, vector_score_answer=0.8, bm25_score_answer=0.6,
			rerank_entailment='entailment', question=self.question,
		)

		response = APIClient().get(reverse('get_question_details'), {'question_id': self.question.id})

		self.assertEqual(response.status_code, 200)
		question_details = response.json()
		self.assertEqual(question_details['semantic_score'], 66.0)
		self.assertEqual(question_details['keyword_score'], 0.0)
		self.assertEqual(question_details['rerank_score'], 98.0)
		self.assertEqual(question_details['answers'][0]['answer'], 'A research assistant')
		self.assertEqual(question_details['answers'][0]['relevance_score'], 97.0)
		self.assertEqual(question_details['answers'][0]['semantic_score'], 67.7)
		self.assertEqual(question_details['answers'][0]['keyword_score'], 0.0)
		self.assertEqual(question_details['answers'][0]['rerank_score'], 91.2)
		self.assertEqual(question_details['sources'][0]['color_code'], 'green')
		self.assertEqual(question_details['sources'][0]['answer_vector_score'], 0.8)
		self.assertEqual(question_details['sources'][0]['answer_bm25_score'], 0.6)
		self.assertEqual(question_details['sources'][0]['rerank_sentiment'], 'entailment')

	def test_get_context_in_direct_chat_creates_question_without_retrieval(self):
		payload = {
			'text': 'What is MyGPT?',
			'model_type': self.model.model_name,
			'dataset': 'ignored-library',
			'use_default_qrs': False,
			'question_best_distance': 0,
			'question_worst_distance': 1,
			'maximum_chunks_count': 5,
			'no_cutoff': True,
			'no_context': True,
		}

		response = APIClient().post(reverse('get_context'), payload, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['context'], '')
		self.assertEqual(response.json()['sources'], [])
		self.assertEqual(response.json()['relevance_score'], 0)
		self.assertTrue(Question.objects.filter(
			question_text='What is MyGPT?',
			question_dataset__dataset_name='llama3:latest_direct_chat',
		).exists())
		self.assertTrue(Dataset.objects.filter(dataset_name='llama3:latest_direct_chat').exists())

	@patch('testdb.views.apis.add_embeddings_to_qna')
	@patch('testdb.views.apis.get_relevance_score')
	@patch('testdb.views.apis.nearestDataChroma')
	def test_get_context_scores_only_returned_sources(self, nearest_data, get_relevance, add_embeddings):
		payload = {
			'text': 'New question',
			'model_type': self.model.model_name,
			'dataset': self.dataset.dataset_name,
			'use_default_qrs': False,
			'question_best_distance': 0,
			'question_worst_distance': 1,
			'maximum_chunks_count': 5,
			'no_cutoff': True,
			'skip_highlight': True,
		}
		cases = [
			('no retrieved chunks', ([], [], [], [], [], [], []), (0, []), 0, []),
			('filtered chunks', (['paper.pdf'], [1], [], [], ['text'], [0.9], [0]), (30, [0.05]), 0, []),
			('returned chunk', (['paper.pdf'], [1], [], [], ['text'], [0.2], [0]), (80, [0.8]), 100, ['paper.pdf']),
		]
		for name, retrieval, relevance, expected_score, expected_documents in cases:
			with self.subTest(name=name):
				nearest_data.return_value = retrieval
				get_relevance.return_value = relevance
				response = APIClient().post(reverse('get_context'), payload, format='json')
				self.assertEqual(response.status_code, 200)
				data = response.json()
				self.assertEqual(data['relevance_score'], expected_score)
				self.assertEqual([source['document'] for source in data['sources']], expected_documents)
				self.assertEqual(data['semantic_score'], relevance[0])
				question = Question.objects.get(question_text=payload['text'], question_dataset=self.dataset)
				self.assertEqual(question.relevance_score, expected_score)

	@patch('testdb.views.apis.add_embeddings_to_qna')
	@patch('testdb.views.apis.get_relevance_score', return_value=(0, []))
	@patch('testdb.views.apis.nearestDataChroma', return_value=([], [], [], [], [], [], []))
	@patch('testdb.views.apis.retrieve_chunks_by_bm25', return_value=([{'text': 'document paper.pdf; page 1; keyword text'}], [10]))
	def test_get_context_scores_keyword_only_sources(self, retrieve, nearest_data, get_relevance, add_embeddings):
		self.dataset.use_bm25 = True
		self.dataset.save()
		payload = {
			'text': 'Keyword question',
			'model_type': self.model.model_name,
			'dataset': self.dataset.dataset_name,
			'use_default_qrs': False,
			'question_best_distance': 0,
			'question_worst_distance': 1,
			'maximum_chunks_count': 5,
			'no_cutoff': True,
			'skip_highlight': True,
		}

		response = APIClient().post(reverse('get_context'), payload, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['relevance_score'], 41)
		self.assertEqual(response.json()['sources'][0]['document'], 'paper.pdf')
		self.assertEqual(Question.objects.get(question_text=payload['text']).relevance_score, 41)

	@patch('testdb.views.apis.predict_hallucination_index', return_value=0)
	def test_save_answer_persists_direct_chat_answer(self, predict_hallucination_index):
		payload = {
			'question_text': self.question.question_text,
			'answer_text': 'A research assistant',
			'answer_no_context_text': 'A research assistant',
			'model_type': self.model.model_name,
			'dataset': self.dataset.dataset_name,
			'no_context': True,
			'answer_best_distance': 0,
			'answer_worst_distance': 1,
			'use_default_ars': True,
			'QRS_p': 1,
			'ARS_q': 2,
			'use_default_hi': True,
			'temperature': 0.7,
			'top_k': 40,
			'top_p': 0.9,
		}

		response = APIClient().post(reverse('save_answer'), payload, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.json()['saved'])
		self.assertEqual(response.json()['relevance_score'], 0)
		self.assertEqual(Answer.objects.get(question=self.question, answer_text='A research assistant').relevance_score, 0)
		predict_hallucination_index.assert_called_once()

	@patch('testdb.views.apis.add_embeddings_to_qna')
	@patch('testdb.views.apis.predict_hallucination_index', return_value=0)
	@patch('testdb.views.apis.rerank_answer_sources', return_value=[])
	@patch('testdb.views.apis.get_answer_distance_by_context')
	def test_save_answer_relevance_matches_returned_sources(self, get_distance, rerank, predict, add_embeddings):
		self.question.relevance_score = 60
		self.question.save()
		payload = {
			'question_text': self.question.question_text,
			'answer_text': 'A research assistant',
			'answer_no_context_text': 'A research assistant',
			'model_type': self.model.model_name,
			'dataset': self.dataset.dataset_name,
			'no_context': False,
			'answer_best_distance': 0,
			'answer_worst_distance': 1,
			'use_default_ars': True,
			'QRS_p': 1,
			'ARS_q': 2,
			'use_default_hi': True,
			'temperature': 0.7,
			'top_k': 40,
			'top_p': 0.9,
		}

		get_distance.return_value = []
		response = APIClient().post(reverse('save_answer'), payload, format='json')
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['sources'], [])
		self.assertEqual(response.json()['relevance_score'], 0)
		self.assertEqual(Answer.objects.latest('id').relevance_score, 0)
		get_distance.assert_not_called()
		rerank.assert_not_called()

		Source.objects.create(source_doc='paper.pdf', source_pointer=1, context='source text', rank=1, question=self.question)
		get_distance.return_value = [0.4]
		payload['use_default_ars'] = False
		response = APIClient().post(reverse('save_answer'), payload, format='json')
		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.json()['sources']), 1)
		self.assertEqual(response.json()['relevance_score'], 94)
		self.assertEqual(Answer.objects.latest('id').relevance_score, 94)