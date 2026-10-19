const SUPABASE_URL =
  "https://eiseszhremqmeodxbcuc.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_1mtFdVK6HheU4pVZ7D2wxg_7tb_9PDO";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


document.addEventListener(
  "DOMContentLoaded",
  function () {

    ensureAnonymousUser();

    const mainButton =
      document.querySelector("#main-button");

    const trialButton =
      document.querySelector("#trial-button");

    const quizCard =
      document.querySelector(".quiz-card");


    let quizQuestions = [];

    let currentQuestionIndex = 0;

    let score = 0;

    let quizMode = "main";


    /* =========================
       トップページ
    ========================= */

    mainButton.addEventListener(
      "click",
      function () {
        startQuiz(100, "main");
      }
    );


    trialButton.addEventListener(
      "click",
      function () {
        startQuiz(5, "trial");
      }
    );


    /* =========================
       クイズ開始
    ========================= */

    async function startQuiz(
      questionCount = 100,
      mode = "main"
    ) {

      quizMode = mode;

      try {

        const response =
          await fetch(
            "data/questions.json",
            {
              cache: "no-store"
            }
          );


        if (!response.ok) {
          throw new Error(
            "問題データを読み込めませんでした。"
          );
        }


        const allQuestions =
          await response.json();


        quizQuestions =
          shuffleArray(
            [...allQuestions]
          ).slice(
            0,
            Math.min(
              questionCount,
              allQuestions.length
            )
          );


        currentQuestionIndex = 0;

        score = 0;


        showQuestion();


      } catch (error) {

        quizCard.innerHTML = `
          <h2>エラー</h2>

          <p>
            問題データを読み込めませんでした。
          </p>
        `;


        console.error(error);
      }
    }


    /* =========================
       問題表示
    ========================= */

    function showQuestion() {

      const question =
        quizQuestions[
          currentQuestionIndex
        ];


      quizCard.innerHTML = `

        <div class="question-meta">

          <span>
            第${currentQuestionIndex + 1}問 /
            全${quizQuestions.length}問
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


        <h2>
          ${question.question}
        </h2>


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

            .map(
              (choice, index) => ({
                choice,
                index
              })
            )

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
                    ${String.fromCharCode(
                      65 + index
                    )}
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
        document.querySelectorAll(
          ".choice-button"
        );


      /* =========================
         複数選択
      ========================= */

      if (
        question.type === "multiple"
      ) {

        const selectedAnswers =
          new Set();


        const submitButton =
          document.querySelector(
            ".submit-answer-button"
          );


        choiceButtons.forEach(
          (button) => {

            button.addEventListener(
              "click",
              function () {

                const selectedIndex =
                  Number(
                    button.dataset.index
                  );


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
          }
        );


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


            checkAnswer(
              answers
            );
          }
        );


      /* =========================
         単一選択
      ========================= */

      } else {

        choiceButtons.forEach(
          (button) => {

            button.addEventListener(
              "click",
              function () {

                const selectedIndex =
                  Number(
                    button.dataset.index
                  );


                checkAnswer(
                  selectedIndex
                );
              }
            );
          }
        );
      }
    }


    /* =========================
       正誤判定
    ========================= */

    async function checkAnswer(
      selectedAnswer
    ) {

      const question =
        quizQuestions[
          currentQuestionIndex
        ];


      const choiceButtons =
        document.querySelectorAll(
          ".choice-button"
        );


      const answerArea =
        document.querySelector(
          "#answer-area"
        );


      const correctAnswers =
        Array.isArray(
          question.answer
        )

          ? [...question.answer].sort(
              (a, b) => a - b
            )

          : [question.answer];


      const selectedAnswers =
        Array.isArray(
          selectedAnswer
        )

          ? [...selectedAnswer].sort(
              (a, b) => a - b
            )

          : [selectedAnswer];


      const isCorrect =

        selectedAnswers.length ===
          correctAnswers.length

        &&

        selectedAnswers.every(
          (answer, index) =>
            answer ===
            correctAnswers[index]
        );


      if (isCorrect) {
        score++;
      }


      const stats =
        await saveFirstAnswer(
          question.id,
          selectedAnswer,
          isCorrect
        );


      choiceButtons.forEach(
        (button) => {

          button.disabled = true;


          const choiceIndex =
            Number(
              button.dataset.index
            );


          if (
            correctAnswers.includes(
              choiceIndex
            )
          ) {

            button.classList.add(
              "correct"
            );
          }


          if (
            selectedAnswers.includes(
              choiceIndex
            )
            &&
            !correctAnswers.includes(
              choiceIndex
            )
          ) {

            button.classList.add(
              "incorrect"
            );
          }
        }
      );


      const resultTitle =
        isCorrect
          ? "正解！"
          : "不正解";


      const resultClass =
        isCorrect
          ? "result-correct"
          : "result-incorrect";


      answerArea.innerHTML = `

        <div
          class="result-box ${resultClass}"
        >

          <div class="result-title">
            ${resultTitle}
          </div>


          <div class="correct-answer">

            <span
              class="correct-answer-title"
            >
              正解
            </span>


            ${correctAnswers

              .map(
                (answerIndex) => `

                  <span
                    class="correct-answer-label"
                  >
                    ${String.fromCharCode(
                      65 + answerIndex
                    )}
                  </span>


                  <span
                    class="correct-answer-text"
                  >
                    ${
                      question.choices[
                        answerIndex
                      ]
                    }
                  </span>

                `
              )

              .join("")}

          </div>


          <div
            class="explanation-title"
          >
            解説
          </div>


          <p class="explanation">
            ${question.explanation}
          </p>


          ${
            stats

              ? `

                <div
                  class="community-stats"
                >

                  <div
                    class="community-stats-title"
                  >
                    みんなの正答率
                  </div>


                  <div
                    class="community-stats-number"
                  >
                    ${stats.accuracy}%
                  </div>


                  <div
                    class="community-stats-detail"
                  >
                    ${stats.attempts}人中
                    ${stats.correct}人正解
                  </div>

                </div>

              `

              : ""
          }


          <div class="current-score">

            <span
              class="current-score-label"
            >
              現在の成績
            </span>


            <span
              class="current-score-number"
            >
              ${score} /
              ${currentQuestionIndex + 1}
            </span>

          </div>


          <div class="report-section">

            <button
              class="report-toggle-button"
            >
              この問題に物申す
            </button>


            <div
              class="report-form hidden"
            >

              <div
                class="report-heading"
              >
                この問題のどこが気になりますか？
              </div>


              <select
                class="report-type"
              >

                <option value="">
                  指摘内容を選んでください
                </option>

                <option
                  value="wrong_answer"
                >
                  正解が違う
                </option>

                <option
                  value="insufficient_condition"
                >
                  条件が不足している
                </option>

                <option
                  value="alternate_answer"
                >
                  別解がある
                </option>

                <option
                  value="explanation_error"
                >
                  解説が不正確
                </option>

                <option
                  value="other"
                >
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


              <button
                class="report-submit-button"
              >
                物申す！
              </button>


              <div
                class="report-status"
              ></div>

            </div>

          </div>

        </div>


        <button
          class="next-button"
        >

          ${
            currentQuestionIndex + 1 <
              quizQuestions.length

              ? "次の問題へ"

              : "結果を見る"
          }

        </button>
      `;


      document
        .querySelector(
          ".next-button"
        )
        .addEventListener(
          "click",
          nextQuestion
        );


      const reportToggleButton =
        document.querySelector(
          ".report-toggle-button"
        );


      const reportForm =
        document.querySelector(
          ".report-form"
        );


      reportToggleButton.addEventListener(
        "click",
        function () {

          reportForm.classList.toggle(
            "hidden"
          );
        }
      );


      const reportSubmitButton =
        document.querySelector(
          ".report-submit-button"
        );


      reportSubmitButton.addEventListener(
        "click",
        async function () {

          const reportType =
            document.querySelector(
              ".report-type"
            ).value;


          const message =
            document
              .querySelector(
                ".report-message"
              )
              .value
              .trim();


          const reportStatus =
            document.querySelector(
              ".report-status"
            );


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


          reportSubmitButton.disabled =
            true;


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


            reportSubmitButton.disabled =
              false;


            reportSubmitButton.textContent =
              "物申す！";
          }
        }
      );
    }


    /* =========================
       次の問題
    ========================= */

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


    /* =========================
       結果画面
    ========================= */

    function showResult() {

      const percentage =
        Math.round(
          (
            score /
            quizQuestions.length
          ) * 100
        );


      /* =========================
         お試し5問
      ========================= */

      if (
        quizMode === "trial"
      ) {

        showTrialResult(
          percentage
        );

        return;
      }


      /* =========================
         本番100問
      ========================= */

      const rankResult =
        getRankResult(
          score
        );


      const rank =
        rankResult.rank;


      const title =
        rankResult.title;


      const comment =
        rankResult.comment;


      quizCard.innerHTML = `

        <div class="result-screen">

          <p class="hero-label">
            RESULT
          </p>


          <h1>
            検定結果
          </h1>


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


          <button
            class="restart-button"
          >
            もう一度挑戦する
          </button>

        </div>
      `;


      document
        .querySelector(
          ".restart-button"
        )
        .addEventListener(
          "click",
          function () {

            startQuiz(
              100,
              "main"
            );
          }
        );
    }


    /* =========================
       お試し結果画面
    ========================= */

    function showTrialResult(
      percentage
    ) {

      quizCard.innerHTML = `

        <div class="result-screen">

          <p class="hero-label">
            TRIAL RESULT
          </p>


          <h1>
            お試し結果
          </h1>


          <div class="final-score">

            ${score}

            <span>
              / 5
            </span>

          </div>


          <div class="percentage">
            正答率 ${percentage}%
          </div>


          <div class="rank-label">
            お試し版のため、
            正式ランク判定はありません
          </div>


          <div class="rank">
            本当の廃人度は100問で判定
          </div>


          <button
            class="next-button
                   main-challenge-button"
          >
            廃人検定100問に挑戦する
          </button>


          <br>


<button
  class="trial-result-button trial-again-button"
>
  もう一度5問やってみる
</button>

        </div>
      `;


      document
        .querySelector(
          ".main-challenge-button"
        )
        .addEventListener(
          "click",
          function () {

            startQuiz(
              100,
              "main"
            );
          }
        );


      document
        .querySelector(
          ".trial-again-button"
        )
        .addEventListener(
          "click",
          function () {

            startQuiz(
              5,
              "trial"
            );
          }
        );
    }


    /* =========================
       シャッフル
    ========================= */

    function shuffleArray(
      array
    ) {

      for (
        let i =
          array.length - 1;

        i > 0;

        i--
      ) {

        const j =
          Math.floor(
            Math.random() *
            (i + 1)
          );


        [
          array[i],
          array[j]
        ] = [
          array[j],
          array[i]
        ];
      }


      return array;
    }
  }
);


/* =========================
   匿名ユーザー
========================= */

async function ensureAnonymousUser() {

  const {
    data: { user },
    error: userError
  } =
    await supabaseClient
      .auth
      .getUser();


  if (
    !userError &&
    user
  ) {

    return user;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .auth
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


/* =========================
   初回回答保存
========================= */

async function saveFirstAnswer(
  questionId,
  selectedIndex,
  isCorrect
) {

  try {

    const user =
      await ensureAnonymousUser();


    if (!user) {

      console.error(
        "回答を保存できませんでした：ユーザー情報がありません"
      );

      return null;
    }


    const {
      error: insertError
    } =
      await supabaseClient
        .from(
          "first_answers"
        )
        .upsert(
          {
            user_id:
              user.id,

            question_id:
              questionId,

            is_correct:
              isCorrect,

            selected_answer:
              selectedIndex
          },
          {
            onConflict:
              "user_id,question_id",

            ignoreDuplicates:
              true
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
    } =
      await supabaseClient
        .rpc(
          "get_question_stats",
          {
            p_question_id:
              questionId
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


/* =========================
   問題報告
========================= */

async function submitQuestionReport(
  questionId,
  reportType,
  message
) {

  try {

    const user =
      await ensureAnonymousUser();


    if (!user) {

      console.error(
        "物申す投稿エラー：ユーザー情報がありません"
      );


      return false;
    }


    const {
      error
    } =
      await supabaseClient
        .from(
          "question_reports"
        )
        .insert(
          {
            user_id:
              user.id,

            question_id:
              questionId,

            report_type:
              reportType,

            message:
              message
          }
        );


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
