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
    lines_too_few_rating = 1 - max(0.0, min(1.0, (line_target - num_lines) / line_target))
    lines_too_many_rating = 1 - max(0.0, min(1.0, (num_lines - line_target) / line_target))
    words_too_few_rating = 1 - max(0.0, min(1.0, (word_target - num_words) / word_target))
    words_too_many_rating = 1 - max(0.0, min(1.0, (num_words - word_target) / word_target))

    return {
        "lines_too_few": lines_too_few_rating,
        "lines_too_many": lines_too_many_rating,
        "words_too_few": words_too_few_rating,
        "words_too_many": words_too_many_rating,
    }


def evaluate(file_path):
    return evaluate_stage1(file_path)
