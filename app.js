const SUPABASE_URL = "https://eiseszhremqmeodxbcuc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1mtFdVK6HheU4pVZ7D2wxg_7tb_9PDO";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

document.addEventListener("DOMContentLoaded", function () {
  ensureAnonymousUser();
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

async function checkAnswer(selectedIndex) {
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

  const stats = await saveFirstAnswer(
  question.id,
  selectedIndex,
  isCorrect
);

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

${
  stats
    ? `
      <div class="community-stats">
        <div class="community-stats-title">
          みんなの正答率
        </div>

        <div class="community-stats-number">
          ${stats.accuracy}%
        </div>

        <div class="community-stats-detail">
          ${stats.attempts}人中
          ${stats.correct}人正解
        </div>
      </div>
    `
    : ""
}

<div class="current-score">
  現在の成績：
  ${score} / ${currentQuestionIndex + 1}
</div>

<div class="report-section">

  <button class="report-toggle-button">
    この問題に物申す
  </button>

  <div class="report-form hidden">

    <div class="report-heading">
      この問題のどこが気になりますか？
    </div>

    <select class="report-type">

      <option value="">
        指摘内容を選んでください
      </option>

      <option value="wrong_answer">
        正解が違う
      </option>

      <option value="insufficient_condition">
        条件が不足している
      </option>

      <option value="alternate_answer">
        別解がある
      </option>

      <option value="version_difference">
        バージョンによって挙動が違う
      </option>

      <option value="explanation_error">
        解説が不正確
      </option>

      <option value="other">
        その他
      </option>

    </select>

    <textarea
      class="report-message"
      maxlength="2000"
      placeholder="具体的な内容を入力してください"
    ></textarea>

    <p class="report-note">
      投稿内容は管理者に送信されます。
      一般には公開されません。
    </p>

    <button class="report-submit-button">
      物申す！
    </button>

    <div class="report-status"></div>

  </div>

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

const reportToggleButton =
  document.querySelector(".report-toggle-button");

const reportForm =
  document.querySelector(".report-form");

reportToggleButton.addEventListener(
  "click",
  function () {
    reportForm.classList.toggle("hidden");
  }
);

const reportSubmitButton =
  document.querySelector(".report-submit-button");

reportSubmitButton.addEventListener(
  "click",
  async function () {
    const reportType =
      document.querySelector(".report-type").value;

    const message =
      document
        .querySelector(".report-message")
        .value
        .trim();

    const reportStatus =
      document.querySelector(".report-status");

    if (!reportType) {
      reportStatus.textContent =
        "指摘内容を選んでください。";

      reportStatus.className =
        "report-status error";

      return;
    }

    if (!message) {
      reportStatus.textContent =
        "具体的な内容を入力してください。";

      reportStatus.className =
        "report-status error";

      return;
    }

    reportSubmitButton.disabled = true;
    reportSubmitButton.textContent =
      "送信中...";

    const success =
      await submitQuestionReport(
        question.id,
        reportType,
        message
      );

    if (success) {
      reportStatus.textContent =
        "送信しました。ありがとうございます。";

      reportStatus.className =
        "report-status success";

      reportSubmitButton.textContent =
        "送信済み";

    } else {
      reportStatus.textContent =
        "送信できませんでした。もう一度お試しください。";

      reportStatus.className =
        "report-status error";

      reportSubmitButton.disabled = false;
      reportSubmitButton.textContent =
        "物申す！";
    }
  }
);
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

async function ensureAnonymousUser() {
  const {
    data: { user },
    error: userError
  } = await supabaseClient.auth.getUser();

  if (!userError && user) {
    return user;
  }

  const {
    data,
    error
  } = await supabaseClient.auth
    .signInAnonymously();

  if (error) {
    console.error(
      "匿名ログインエラー:",
      error
    );

    return null;
  }

  return data.user;
}

async function saveFirstAnswer(
  questionId,
  selectedIndex,
  isCorrect
) {
  try {
    const user = await ensureAnonymousUser();

    if (!user) {
      console.error(
        "回答を保存できませんでした：ユーザー情報がありません"
      );
      return null;
    }

    const { error: insertError } =
      await supabaseClient
.from("first_answers")
.upsert(
  {
    user_id: user.id,
    question_id: questionId,
    is_correct: isCorrect,
    selected_answer: selectedIndex
  },
  {
    onConflict: "user_id,question_id",
    ignoreDuplicates: true
  }
);

    if (
      insertError &&
      insertError.code !== "23505"
    ) {
      console.error(
        "回答保存エラー:",
        insertError
      );

      return null;
    }

    const {
      data: statsData,
      error: statsError
    } = await supabaseClient.rpc(
      "get_question_stats",
      {
        p_question_id: questionId
      }
    );

    if (statsError) {
      console.error(
        "正答率取得エラー:",
        statsError
      );

      return null;
    }

    if (
      !statsData ||
      statsData.length === 0
    ) {
      return null;
    }

    return statsData[0];

  } catch (error) {
    console.error(
      "回答処理エラー:",
      error
    );

    return null;
  }
}

async function submitQuestionReport(
  questionId,
  reportType,
  message
) {
  try {
    const user = await ensureAnonymousUser();

    if (!user) {
      console.error(
        "物申す投稿エラー：ユーザー情報がありません"
      );

      return false;
    }

    const { error } =
      await supabaseClient
        .from("question_reports")
        .insert({
          user_id: user.id,
          question_id: questionId,
          report_type: reportType,
          message: message
        });

    if (error) {
      console.error(
        "物申す投稿エラー:",
        error
      );

      return false;
    }

    return true;

  } catch (error) {
    console.error(
      "物申す投稿処理エラー:",
      error
    );

    return false;
  }
}
