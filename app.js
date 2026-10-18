document.addEventListener("DOMContentLoaded", function () {
  const startButton = document.querySelector(".start-button");
  const quizCard = document.querySelector(".quiz-card");

  let quizQuestions = [];
  let currentQuestionIndex = 0;
  let score = 0;

  startButton.addEventListener("click", startQuiz);

  async function startQuiz() {
    try {
      const response = await fetch("data/questions.json");

      if (!response.ok) {
        throw new Error("問題データを読み込めませんでした。");
      }

      const allQuestions = await response.json();

      quizQuestions = shuffleArray([...allQuestions]).slice(
        0,
        Math.min(100, allQuestions.length)
      );

      currentQuestionIndex = 0;
      score = 0;

      showQuestion();
    } catch (error) {
      quizCard.innerHTML = `
        <h2>エラー</h2>
        <p>問題データを読み込めませんでした。</p>
      `;

      console.error(error);
    }
  }

  function showQuestion() {
    const question = quizQuestions[currentQuestionIndex];

    quizCard.innerHTML = `
      <div class="question-meta">
        <span>
          第${currentQuestionIndex + 1}問 / ${quizQuestions.length}問
        </span>

        <span class="category">
          ${question.category}
        </span>
      </div>

      <h2>${question.question}</h2>

      <div class="choices">
        ${question.choices
          .map(
            (choice, index) => `
              <button
                class="choice-button"
                data-index="${index}"
              >
                ${choice}
              </button>
            `
          )
          .join("")}
      </div>

      <div id="answer-area"></div>
    `;

    const choiceButtons =
      document.querySelectorAll(".choice-button");

    choiceButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const selectedIndex =
          Number(button.dataset.index);

        checkAnswer(selectedIndex);
      });
    });
  }

  function checkAnswer(selectedIndex) {
    const question =
      quizQuestions[currentQuestionIndex];

    const choiceButtons =
      document.querySelectorAll(".choice-button");

    const answerArea =
      document.querySelector("#answer-area");

    const isCorrect =
      selectedIndex === question.answer;

    if (isCorrect) {
      score++;
    }

    choiceButtons.forEach((button, index) => {
      button.disabled = true;

      if (index === question.answer) {
        button.classList.add("correct");
      }

      if (
        index === selectedIndex &&
        selectedIndex !== question.answer
      ) {
        button.classList.add("incorrect");
      }
    });

    const resultTitle = isCorrect
      ? "正解！"
      : "不正解";

    const resultClass = isCorrect
      ? "result-correct"
      : "result-incorrect";

    answerArea.innerHTML = `
      <div class="result-box ${resultClass}">
        <div class="result-title">
          ${resultTitle}
        </div>

        <div class="correct-answer">
          正解：
          ${question.choices[question.answer]}
        </div>

        <div class="explanation-title">
          解説
        </div>

        <p class="explanation">
          ${question.explanation}
        </p>

        <div class="current-score">
          現在の成績：
          ${score} / ${currentQuestionIndex + 1}
        </div>
      </div>

      <button class="next-button">
        ${
          currentQuestionIndex + 1 <
          quizQuestions.length
            ? "次の問題へ"
            : "結果を見る"
        }
      </button>
    `;

    document
      .querySelector(".next-button")
      .addEventListener("click", nextQuestion);
  }

  function nextQuestion() {
    currentQuestionIndex++;

    if (
      currentQuestionIndex <
      quizQuestions.length
    ) {
      showQuestion();
    } else {
      showResult();
    }
  }

  function showResult() {
    const percentage =
      Math.round(
        (score / quizQuestions.length) * 100
      );

    let rank = "";

    if (percentage === 100) {
      rank = "風来神";
    } else if (percentage >= 90) {
      rank = "廃人を超えし者";
    } else if (percentage >= 75) {
      rank = "アスカ廃人";
    } else if (percentage >= 60) {
      rank = "上級風来人";
    } else if (percentage >= 40) {
      rank = "裏白経験者";
    } else if (percentage >= 20) {
      rank = "アスカ経験者";
    } else {
      rank = "まだ人間";
    }

    quizCard.innerHTML = `
      <div class="result-screen">

        <p class="hero-label">
          RESULT
        </p>

        <h1>検定結果</h1>

        <div class="final-score">
          ${score}
          <span>
            / ${quizQuestions.length}
          </span>
        </div>

        <div class="percentage">
          正答率 ${percentage}%
        </div>

        <div class="rank-label">
          あなたの称号
        </div>

        <div class="rank">
          ${rank}
        </div>

        <button class="restart-button">
          もう一度挑戦する
        </button>

      </div>
    `;

    document
      .querySelector(".restart-button")
      .addEventListener("click", startQuiz);
  }

  function shuffleArray(array) {
    for (
      let i = array.length - 1;
      i > 0;
      i--
    ) {
      const j =
        Math.floor(
          Math.random() * (i + 1)
        );

      [array[i], array[j]] =
        [array[j], array[i]];
    }

    return array;
  }
});
