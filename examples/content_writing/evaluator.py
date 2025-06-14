from openevolve.evaluation_result import EvaluationResult


def linear_feedback(actual, target):
    deviation = abs(actual - target) / target
    return 1 - min(1.0, deviation)


def evaluate_stage1(file_path):
    # Read in file_path
    with open(file_path, 'r') as file:
        content = file.read()

    # Count lines and words
    lines = content.splitlines()
    num_lines = len(lines)
    num_words = sum(len(line.split()) for line in lines)

    # Linear feedback between 0 and 1
    line_target = 7
    word_target = line_target*7

    line_rating = linear_feedback(num_lines, line_target)
    word_rating = linear_feedback(num_words, word_target)

    combined_rating = (line_rating + word_rating) / 2

    # Create textual feedback
    length_comment_parts = []

    # Line count feedback
    line_ratio = num_lines / line_target
    if line_ratio > 1.2:
        length_comment_parts.append("Reduce the number of lines.")
    elif line_ratio < 0.8:
        length_comment_parts.append("Increase the number of lines.")
    else:
        length_comment_parts.append("Line count is just right.")

    # Words per line feedback
    words_per_line = num_words / num_lines if num_lines else 0
    target_words_per_line = word_target / line_target
    words_per_line_ratio = words_per_line / target_words_per_line

    if words_per_line_ratio > 1.2:
        length_comment_parts.append("Reduce the number of words per line.")
    elif words_per_line_ratio < 0.8:
        length_comment_parts.append("Increase the number of words per line.")

    length_comment = " ".join(length_comment_parts)

    return EvaluationResult(
        metrics={
            "length_good": combined_rating,
        },
        artifacts={
            "length_recommendation": length_comment,
        },
    )


def evaluate(file_path):
    return evaluate_stage1(file_path)
