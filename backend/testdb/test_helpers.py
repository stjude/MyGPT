from django.test import SimpleTestCase

from testdb.views.helpers import min_max_normalization


class NormalizationTests(SimpleTestCase):
	def test_distance_scores_are_bounded_and_preserve_in_range_values(self):
		for reverse in (False, True):
			with self.subTest(reverse=reverse):
				self.assertEqual(
					min_max_normalization([-1, 0, 0.5, 1, 100], 0, 1, reverse),
					[1, 1, 0.5, 0, 0],
				)

	def test_similarity_scores_are_bounded_and_preserve_in_range_values(self):
		self.assertEqual(
			min_max_normalization([-1, 0, 10, 20, 100], 20, 0),
			[0, 0, 0.5, 1, 1],
		)

	def test_composite_scores_allow_negative_calibration_bounds(self):
		self.assertEqual(min_max_normalization([-10, -5, 0, 5, 10], 5, -5), [0, 0, 0.5, 1, 1])

	def test_empty_scores_remain_empty(self):
		self.assertEqual(min_max_normalization([], 0, 0), [])
