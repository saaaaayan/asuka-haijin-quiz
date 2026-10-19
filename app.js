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
const response = await fetch(
  "data/questions.json",
  {
    cache: "no-store"
  }
);

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
    第${currentQuestionIndex + 1}問 / 全${quizQuestions.length}問
  </span>

  <div class="question-meta-right">
    <span class="question-id">
      問題ID #${question.id}
    </span>

    <span class="category">
      ${question.category}
    </span>
  </div>
</div>

    <h2>${question.question}</h2>

    ${
      question.type === "multiple"
        ? `
          <div class="question-instruction">
            ${question.instruction}
          </div>
        `
        : ""
    }

    <div class="choices">
${question.choices
  .map((choice, index) => ({
    choice,
    index
  }))
  .filter(
    ({ choice }) =>
      typeof choice === "string" &&
      choice.trim() !== ""
  )
  .map(
    ({ choice, index }) => `
      <button
        class="choice-button"
        data-index="${index}"
      >
        <span class="choice-label">
          ${String.fromCharCode(65 + index)}
        </span>

        <span class="choice-text">
          ${choice}
        </span>
      </button>
    `
  )
  .join("")}
    </div>

    ${
      question.type === "multiple"
        ? `
          <button
            class="submit-answer-button"
            disabled
          >
            回答する
          </button>
        `
        : ""
    }

    <div id="answer-area"></div>
  `;

  const choiceButtons =
    document.querySelectorAll(".choice-button");

  if (question.type === "multiple") {

    const selectedAnswers = new Set();

    const submitButton =
      document.querySelector(
        ".submit-answer-button"
      );

    choiceButtons.forEach((button) => {

      button.addEventListener(
        "click",
        function () {

          const selectedIndex =
            Number(button.dataset.index);

          if (
            selectedAnswers.has(
              selectedIndex
            )
          ) {
            selectedAnswers.delete(
              selectedIndex
            );

            button.classList.remove(
              "selected"
            );

          } else {
            selectedAnswers.add(
              selectedIndex
            );

            button.classList.add(
              "selected"
            );
          }

          submitButton.disabled =
            selectedAnswers.size === 0;
        }
      );
    });

submitButton.addEventListener(
  "click",
  function () {

    const answers =
      Array.from(
        selectedAnswers
      ).sort(
        (a, b) => a - b
      );

    submitButton.remove();

    checkAnswer(answers);
  }
);

  } else {

    choiceButtons.forEach((button) => {

      button.addEventListener(
        "click",
        function () {

          const selectedIndex =
            Number(button.dataset.index);

          checkAnswer(selectedIndex);
        }
      );
    });
  }
}

async function checkAnswer(selectedAnswer) {
    const question =
      quizQuestions[currentQuestionIndex];

    const choiceButtons =
      document.querySelectorAll(".choice-button");

    const answerArea =
      document.querySelector("#answer-area");

const correctAnswers =
  Array.isArray(question.answer)
    ? [...question.answer].sort((a, b) => a - b)
    : [question.answer];

const selectedAnswers =
  Array.isArray(selectedAnswer)
    ? [...selectedAnswer].sort((a, b) => a - b)
    : [selectedAnswer];

const isCorrect =
  selectedAnswers.length === correctAnswers.length &&
  selectedAnswers.every(
    (answer, index) =>
      answer === correctAnswers[index]
  );

if (isCorrect) {
  score++;
}

const stats = await saveFirstAnswer(
  question.id,
  selectedAnswer,
  isCorrect
);

choiceButtons.forEach((button) => {
  button.disabled = true;

  const choiceIndex =
    Number(button.dataset.index);

  if (correctAnswers.includes(choiceIndex)) {
    button.classList.add("correct");
  }

  if (
    selectedAnswers.includes(choiceIndex) &&
    !correctAnswers.includes(choiceIndex)
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

  <span class="correct-answer-title">
    正解
  </span>

  ${correctAnswers
    .map(
      (answerIndex) => `
        <span class="correct-answer-label">
          ${String.fromCharCode(65 + answerIndex)}
        </span>

        <span class="correct-answer-text">
          ${question.choices[answerIndex]}
        </span>
      `
    )
    .join("")}

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
  <span class="current-score-label">
    現在の成績
  </span>

  <span class="current-score-number">
    ${score} / ${currentQuestionIndex + 1}
  </span>
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
let title = "";
let comment = "";

if (score === 100) {
  rank = "SSS";
  title = "廃人";
  comment = `
    <p>100問、全問正解。</p>
    <p>おめでとうございます。</p>
    <p>あなたは本検定において、正式に「廃人」と認定されました。</p>
    <p>その膨大な知識と、アスカ見参に捧げてきた情熱と時間に、心から敬意を表します。</p>
    <p>なお、この称号を取得しても、社会的地位が向上することは一切ありません。</p>
    <p><strong>廃人認定、本当におめでとうございます。</strong></p>
  `;
} else if (score === 99) {
  rank = "SS";
  title = "開発者ですか？";
  comment = `
    <p>ちょっと待ってください。</p>
    <p>なぜそこまで知っているのですか？</p>
    <p>普通にプレイしていて知るはずのないような仕様まで把握していますね。</p>
    <p>念のため、スタッフロールにあなたの名前が載っていないか確認させてください。</p>
    <p>もし開発に関わっていないのだとしたら、なおさら問題です。</p>
    <p><strong>あなたはいったい、何者なのですか？</strong></p>
  `;
} else if (score >= 95) {
  rank = "S+";
  title = "アスカ星人";
  comment = `
    <p>おめでとうございます。</p>
    <p>あなたのアスカ知識は、地球人の常識を大きく逸脱しています。</p>
    <p>この結果を受け、検定委員会では、あなたが本当に地球人なのか慎重に調査する必要があると判断しました。</p>
    <p>なお、本人は地球生まれと主張している模様です。</p>
    <p>現時点では宇宙人であるという決定的な証拠は見つかっていませんが、引き続き警戒を続けます。</p>
    <p><strong>どうか地球の平和を脅かさないようお願いします。</strong></p>
  `;
} else if (score >= 90) {
  rank = "S";
  title = "生けるアスカWiki";
  comment = `
    <p>攻略Wikiを開く必要はありません。あなたに聞けばいいのです。</p>
    <p>モンスターの特性から、誰も気にしないような細かい仕様まで、頭の中に詰め込まれています。</p>
    <p>もはや歩く攻略データベースです。</p>
    <p>その記憶力を別のことに使っていれば、どんな人生だったのでしょうか。</p>
    <p><strong>残念ながら、その可能性を検証することはもうできません。</strong></p>
  `;
} else if (score >= 85) {
  rank = "A+";
  title = "フェイに問題を出すレベル";
  comment = `
    <p>もはやフェイから問題を出されるだけでは満足できないでしょう。</p>
    <p>今度はあなたが出題する番です。</p>
    <p>その豊富な知識を生かして、ぜひ難問を作ってみてください。</p>
    <p>ただし、問題がマニアックすぎて誰も正解できず、企画そのものが成立しなくなる恐れがあります。</p>
    <p><strong>出題者には、ある程度の良識も必要です。</strong></p>
  `;
} else if (score >= 80) {
  rank = "A";
  title = "アスカ見参博士（自称）";
  comment = `
    <p>あなたの知識は相当なものです。</p>
    <p>研究論文はありません。学位もありません。誰も認定していません。</p>
    <p>それでもアスカ見参について語り始めたら止まらないので、周囲はもう博士と呼ぶしかありません。</p>
    <p>ただし、その知識を披露できる場は極めて限られています。</p>
    <p><strong>今後も数少ない発表の機会を大切にしてください。</strong></p>
  `;
} else if (score >= 75) {
  rank = "A−";
  title = "アスカ見参で飯が食える";
  comment = `
    <p>三度の飯よりアスカを選び続けた結果、とうとうアスカで飯が食えるほどの知識を身につけました。</p>
    <p>長年の努力が報われた瞬間です。</p>
    <p>なお、この知識をどこで換金できるのかは、現在も調査中です。</p>
    <p><strong>当面は本業を続けることをおすすめします。</strong></p>
  `;
} else if (score >= 70) {
  rank = "B+";
  title = "履歴書に書けるレベル";
  comment = `
    <p>特技欄に「アスカ見参」と書いても、もはや嘘ではありません。</p>
    <p>これだけの知識があれば、立派な専門家です。</p>
    <p>ただし、面接官がその価値を理解してくれる可能性は極めて低いでしょう。</p>
    <p>なお、採用担当者から「それは仕事にどう役立ちますか？」と質問された場合の回答は、各自でご用意ください。</p>
  `;
} else if (score >= 65) {
  rank = "B";
  title = "生粋のアスカっ子";
  comment = `
    <p>「まだアスカなんかやってるの？」</p>
    <p>そんな言葉を何度聞いたことでしょう。</p>
    <p>しかし、あなたにとっては、アスカをやっていない人のほうが不思議なのです。</p>
    <p>流行りのゲームには目もくれず、今日も元気にダンジョンへ。</p>
    <p>もう普通の人とは少し違う世界に住んでいます。</p>
  `;
} else if (score >= 60) {
  rank = "B−";
  title = "アスカ見参依存症";
  comment = `
    <p>「今日はちょっとだけ遊ぼう」</p>
    <p>そう思って起動したはずが、気づけば数時間。</p>
    <p>何度も引退を考えたことでしょう。しかし、いつの間にかまたダンジョンに潜っています。</p>
    <p>どうやら、症状はかなり進行しているようです。</p>
    <p>ただ、ご安心ください。アスカ見参をやめれば改善します。</p>
    <p><strong>もっとも、それができるなら苦労していません。</strong></p>
  `;
} else if (score >= 50) {
  rank = "C+";
  title = "三度の飯よりアスカ好き";
  comment = `
    <p>食事を忘れてアスカをプレイした夜もあったでしょう。</p>
    <p>しかし、残念ながら愛情だけでは解けない問題もあるようです。</p>
    <p>アスカ愛は十分伝わりましたので、そろそろご飯を食べてください。</p>
  `;
} else if (score >= 40) {
  rank = "C";
  title = "アスカの話になると急に早口";
  comment = `
    <p>普段はおとなしいのに、アスカの話題が出た瞬間、急に早口になるタイプですね。</p>
    <p>聞かれてもいないのに、アイテムの使い方やモンスターの特性を延々と説明してしまいます。</p>
    <p>ただし、マニアックな仕様について質問されると、急に声が小さくなる傾向があります。</p>
  `;
} else if (score >= 35) {
  rank = "C−";
  title = "攻略Wikiが愛読書";
  comment = `
    <p>アスカの攻略Wikiを眺めているだけで、気がつけば数時間。</p>
    <p>普通の人にとっては意味不明な数字の羅列も、あなたにとっては極上の読み物です。</p>
    <p>ただし、読んだ内容をどれだけ覚えているかは別問題のようです。</p>
  `;
} else if (score >= 20) {
  rank = "D+";
  title = "アスカ見参を知っている人";
  comment = `
    <p>「アスカ見参」というゲームを知っている。それだけでも今の時代では立派な希少種です。</p>
    <p>問題文が何を言っているのかわからなかった？</p>
    <p>大丈夫です。それが普通の反応です。</p>
  `;
} else {
  rank = "D";
  title = "まだ人間";
  comment = `
    <p>おめでとうございます。あなたはまだ人間です。</p>
    <p>アスカ見参の知識に脳の容量を奪われていない、極めて健全な状態です。</p>
    <p>このまま普通の人生を歩むことをおすすめします。</p>
  `;
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
  あなたのランク・称号
</div>

<div class="rank-grade">
  ${rank}
</div>

<div class="rank">
  ${title}
</div>

<div class="rank-comment">
  ${comment}
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
