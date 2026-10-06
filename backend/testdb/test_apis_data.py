from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from testdb.models import (
	Answer,
	Conversation,
	Dataset,
	DisclaimerAgreement,
	EmbeddingModel,
	Model,
	PaperSections,
	Papers,
	Question,
	Videos,
)


class DatasetAPITests(TestCase):
	def test_get_datasets_combines_group_and_personal_datasets_in_name_order(self):
		Dataset.objects.create(dataset_name='Team Library', user_email='owner@example.com', user_group='research')
		Dataset.objects.create(dataset_name='Alice Library', user_email='alice@example.com', user_group='user')
		Dataset.objects.create(dataset_name='Other Library', user_email='other@example.com', user_group='other')

		response = APIClient().post(
			reverse('get_datasets'),
			{'user_email': 'alice@example.com', 'user_group': 'research'},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual([item['dataset_name'] for item in response.json()], ['Alice Library', 'Team Library'])

	def test_get_datasets_without_email_returns_only_public_user_libraries(self):
		Dataset.objects.create(dataset_name='Public Library', user_email='-', user_group='user')
		Dataset.objects.create(dataset_name='Private Library', user_email='alice@example.com', user_group='user')
		Dataset.objects.create(dataset_name='Group Library', user_email='-', user_group='research')

		response = APIClient().post(
			reverse('get_datasets'),
			{'user_email': '', 'user_group': ''},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual([item['dataset_name'] for item in response.json()], ['Public Library'])

	def test_get_dataset_details_resolves_group_library(self):
		Dataset.objects.create(dataset_name='Team Library', user_email='-', user_group='research')

		response = APIClient().post(
			reverse('get_dataset_details'),
			{'dataset': 'Team Library', 'user_email': 'alice@example.com', 'user_group': 'research'},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['dataset_name'], 'Team Library')

	def test_get_documents_returns_papers_sorted_by_title(self):
		dataset = Dataset.objects.create(dataset_name='My Library', user_email='alice@example.com')
		Papers.objects.create(paper_title='Zeta paper', paper_dataset=dataset)
		Papers.objects.create(paper_title='Alpha paper', paper_dataset=dataset)

		response = APIClient().post(
			reverse('get_documents'),
			{'dataset': 'My Library', 'user_email': 'alice@example.com', 'user_group': 'user'},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['dataset_type'], 'papers')
		self.assertEqual([item['paper_title'] for item in response.json()['documents']], ['Alpha paper', 'Zeta paper'])

	def test_get_sections_sorts_by_count_then_title(self):
		dataset = Dataset.objects.create(dataset_name='My Library')
		PaperSections.objects.create(section_title='Methods', section_count=3, section_dataset=dataset)
		PaperSections.objects.create(section_title='Results', section_count=5, section_dataset=dataset)
		PaperSections.objects.create(section_title='Abstract', section_count=3, section_dataset=dataset)

		response = APIClient().post(reverse('get_sections'), {'dataset_name': 'My Library'}, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			[item['section_title'] for item in response.json()['sections']],
			['Results', 'Abstract', 'Methods'],
		)

	def test_get_embedding_model_details_returns_configured_model(self):
		Dataset.objects.create(dataset_name='My Library', embedding_model='nomic-embed-text')
		EmbeddingModel.objects.create(model_name='nomic-embed-text', model_size='0.27', best_distance_q=0.2)

		response = APIClient().get(reverse('get_embedding_model_details'), {'dataset': 'My Library'})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['embedding_model']['model_name'], 'nomic-embed-text')
		self.assertEqual(response.json()['embedding_model']['best_distance_q'], 0.2)

	def test_update_dataset_saves_submitted_fields_only(self):
		dataset = Dataset.objects.create(dataset_name='My Library', dataset_prompt='original prompt')

		response = APIClient().post(
			reverse('update_dataset'),
			{'dataset': dataset.dataset_name, 'system_prompt': 'updated prompt', 'Qsem_a': 2.5, 'HI_by_equation': True},
			format='json',
		)

		dataset.refresh_from_db()
		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.json()['saved'])
		self.assertEqual(dataset.dataset_prompt, 'updated prompt')
		self.assertEqual(dataset.coefficient_a_Qsem, 2.5)
		self.assertTrue(dataset.HI_by_equation)
		self.assertEqual(dataset.coefficient_b_Qkey, -4)

	def test_update_dataset_reports_missing_and_unknown_datasets(self):
		client = APIClient()
		missing_name = client.post(reverse('update_dataset'), {}, format='json')
		unknown_dataset = client.post(reverse('update_dataset'), {'dataset': 'missing-library'}, format='json')

		self.assertEqual(missing_name.status_code, 400)
		self.assertEqual(missing_name.json()['error_message'], 'Dataset name is required')
		self.assertEqual(unknown_dataset.status_code, 404)
		self.assertEqual(unknown_dataset.json()['error_message'], 'Dataset not found')

	def test_invalid_dataset_names_are_rejected_before_delete(self):
		response = APIClient().get(
			reverse('delete_dataset'),
			{'dataset': '../outside', 'user_email': 'alice@example.com'},
		)

		self.assertEqual(response.status_code, 400)
		self.assertEqual(response.json()['error_message'], 'Invalid dataset name')

	def test_vector_and_embedding_jobs_reject_invalid_dataset_names(self):
		client = APIClient()
		vector_response = client.get(reverse('get_vector_embeddings'), {'datasets': 'bad/name'})
		embedding_response = client.get(reverse('add_dataset_embeddings'), {'dataset': 'bad/name'})

		self.assertEqual(vector_response.status_code, 400)
		self.assertEqual(vector_response.json()['error_message'], 'Invalid datasets parameter')
		self.assertEqual(embedding_response.status_code, 400)
		self.assertEqual(embedding_response.json()['error_message'], 'Invalid dataset name')

	@patch('testdb.views.apis.get_answer_distance', return_value=[0.25, 0.75])
	def test_get_distance_between_answers_returns_embedding_distances(self, get_distance):
		response = APIClient().post(
			reverse('get_distance_between_answers'),
			{'sentence1': 'first', 'sentence2': 'second', 'embedding_model': 'embed-model'},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {'distances': [0.25, 0.75]})
		get_distance.assert_called_once_with('first', 'second', 'embed-model')

	@patch('testdb.views.apis.get_embedding_model_ef')
	def test_add_embedding_models_skips_existing_models(self, get_embedding_model_ef):
		EmbeddingModel.objects.create(model_name='existing-embed', model_size='1.00')
		response = APIClient().post(
			reverse('add_embedding_models'),
			{'embedding_models': [
				{'name': 'existing-embed', 'size': '2.00', 'source': 'ollama'},
				{'name': 'new-embed', 'size': '0.50', 'source': 'ollama'},
			]},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(EmbeddingModel.objects.count(), 2)
		self.assertEqual(EmbeddingModel.objects.get(model_name='existing-embed').model_size, '1.00')
		get_embedding_model_ef.assert_called_once_with('new-embed', True)

	def test_frontend_settings_creates_defaults_when_missing(self):
		response = APIClient().get(reverse('frontend_settings'))

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['settings'], {
			'show_no_context_switch': False,
			'restriction_without_login': False,
			'azure_login': False,
			'django_login': False,
			'disable_chat_without_login': False,
		})

	@patch('testdb.views.apis.add_demo_dataset')
	def test_add_demo_dataset_delegates_to_dataset_service(self, add_demo_dataset):
		response = APIClient().get(reverse('add_demo_dataset'), {'embedding_model': 'embed-model'})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {'added': True})
		add_demo_dataset.assert_called_once_with('embed-model')

	def test_get_username_returns_empty_value_for_invalid_token(self):
		response = APIClient().post(reverse('get_username'), {'access_token': 'not-a-token'}, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {'username': ''})

	def test_disclaimer_agreement_records_user_acceptance(self):
		User.objects.create_user(username='researcher')
		response = APIClient().post(reverse('disclaimer_agreement'), {'username': 'researcher'}, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {'agreed': True})
		self.assertTrue(DisclaimerAgreement.objects.filter(user='researcher').exists())

	def test_feedback_updates_rating_and_comment(self):
		dataset = Dataset.objects.create(dataset_name='My Library')
		model = Model.objects.create(model_name='llama3:latest')
		conversation = Conversation.objects.create(conversation_dataset=dataset)
		question = Question.objects.create(
			question_text='Question', model_type=model, question_dataset=dataset, conversation=conversation,
		)
		answer = Answer.objects.create(answer_text='Answer', question=question, model_type=model)
		response = APIClient().post(
			reverse('feedback'),
			{'answer_text': 'Answer', 'rating': 1, 'user_comment': 'Helpful'},
			format='json',
		)

		answer.refresh_from_db()
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {'saved': True})
		self.assertEqual(answer.rating, 1)
		self.assertEqual(answer.user_comment, 'Helpful')

	@patch('testdb.views.apis.add_video_to_chroma')
	@patch('testdb.views.apis.get_youtube_transcript')
	@patch('testdb.views.apis.YouTube')
	def test_add_video_library_creates_and_indexes_video(self, youtube, get_transcript, add_to_chroma):
		youtube.return_value.title = 'Research talk'
		response = APIClient().post(reverse('add_video_library'), {
			'dataset_name': 'Research talks',
			'embedding_model': 'embed-model',
			'video_urls': 'https://youtube.com/watch?v=video123',
			'playlist_url': '',
			'user': '',
			'user_email': 'alice@example.com',
			'user_group': 'research',
		})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {'added': True})
		video = Videos.objects.get(video_title='Research talk')
		self.assertEqual(video.video_dataset.dataset_name, 'Research_talks')
		get_transcript.assert_called_once_with('Research_talks', ['video123'], ['Research talk'])
		add_to_chroma.assert_called_once_with('Research_talks', 'embed-model')