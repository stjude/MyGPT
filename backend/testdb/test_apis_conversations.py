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
		)

	def test_get_conversations_omits_questions_without_answers(self):
		Answer.objects.create(answer_text='A research assistant', question=self.question, model_type=self.model)
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
		Answer.objects.create(answer_text='A research assistant', question=self.question, model_type=self.model)
		Source.objects.create(
			source_doc='paper.pdf', source_pointer=2, context='source text',
			vector_score=0.7, question=self.question,
		)

		response = APIClient().get(reverse('get_question_details'), {'question_id': self.question.id})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['answers'][0]['answer'], 'A research assistant')
		self.assertEqual(response.json()['sources'][0]['color_code'], 'green')

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
		self.assertTrue(Question.objects.filter(
			question_text='What is MyGPT?',
			question_dataset__dataset_name='llama3:latest_direct_chat',
		).exists())
		self.assertTrue(Dataset.objects.filter(dataset_name='llama3:latest_direct_chat').exists())

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
			'use_default_ars': False,
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
		self.assertTrue(Answer.objects.filter(question=self.question, answer_text='A research assistant').exists())
		predict_hallucination_index.assert_called_once()