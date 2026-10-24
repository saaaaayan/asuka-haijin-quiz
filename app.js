const SUPABASE_URL =
  "https://eiseszhremqmeodxbcuc.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_1mtFdVK6HheU4pVZ7D2wxg_7tb_9PDO";

const QUIZ_SAVE_KEY =
  "asuka-haijin-quiz-progress-v1";

const QUIZ_LAST_RESULT_KEY =
  "asuka-haijin-quiz-last-result-v1";

const STORAGE_SCHEMA_VERSION = 2;
const QUESTION_SET_VERSION = 1;
const CATEGORY_STATS_VERSION = 1;


/* =========================
   カテゴリは5つで固定
========================= */

const VALID_QUESTION_CATEGORIES = [
  "モンスター",
  "アイテム",
  "ダンジョン",
  "仕様",
  "その他"
];


const VALID_QUESTION_TYPES = [
  "single",
  "multiple"
];


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
      document.querySelector(
        "#main-button"
      );

    const trialButton =
      document.querySelector(
        "#trial-button"
      );

    const quizCard =
      document.querySelector(
        ".quiz-card"
      );

    const resumeArea =
      document.querySelector(
        "#resume-area"
      );

    const resumeButton =
      document.querySelector(
        "#resume-button"
      );

    const resumeDetail =
      document.querySelector(
        "#resume-detail"
      );

    const resumeResetButton =
      document.querySelector(
        "#resume-reset-button"
      );

    const heroButtons =
      document.querySelector(
        ".hero-buttons"
      );

    const trialNote =
      document.querySelector(
        ".trial-note"
      );


    let previousResultArea =
      null;

    let quizQuestions =
      [];

    let currentQuestionIndex =
      0;

    let score =
      0;

    let quizMode =
      "main";

    let categoryStats =
      {};

    let categoryStatsComplete =
      true;

    let answerLocked =
      false;

    let quizSessionId =
      null;


    /* =========================
       開発用URL
    ========================= */

    const urlParams =
      new URLSearchParams(
        window.location.search
      );

    const isTestMode =
      urlParams.get("test") === "1";

    const isResultTestMode =
      urlParams.get("resulttest") === "1";

    const isDataTestMode =
      urlParams.get("datatest") === "1";

    const isLastResultTestMode =
      urlParams.get("lastresulttest") === "1";


    function shouldTrackAnalytics() {

      return (
        !isTestMode &&
        !isResultTestMode &&
        !isDataTestMode &&
        !isLastResultTestMode
      );
    }


    /* =========================
       トップページ
    ========================= */

    if (mainButton) {

      mainButton.addEventListener(
        "click",
        startMainQuizFromBeginning
      );
    }


    if (trialButton) {

      trialButton.addEventListener(
        "click",
        function () {

          startQuiz(
            5,
            "trial"
          );
        }
      );
    }


    if (resumeButton) {

      resumeButton.addEventListener(
        "click",
        resumeQuiz
      );
    }


    if (resumeResetButton) {

      resumeResetButton.addEventListener(
        "click",
        async function () {

          const confirmed =
            confirm(
              "途中までのデータを削除しますか？"
            );

          if (!confirmed) {
            return;
          }


          const saved =
            loadProgress();


          if (
            saved &&
            saved.sessionId
          ) {

            await abandonQuizSession(
              saved.sessionId
            );
          }


          clearProgress();

          window.location.reload();
        }
      );
    }


    updateResumeArea();

    setupPreviousResultArea();


    if (isLastResultTestMode) {

      runLastResultTest();

      return;
    }


    if (isDataTestMode) {

      runDataValidationTest();

      return;
    }


    if (isResultTestMode) {

      showResultTest();

      return;
    }


    /* =========================
       前回結果表示
    ========================= */

    function setupPreviousResultArea() {

      if (!heroButtons) {
        return;
      }


      previousResultArea =
        document.createElement(
          "div"
        );


      previousResultArea.id =
        "previous-result-area";

      previousResultArea.style.marginTop =
        "18px";


      heroButtons.insertAdjacentElement(
        "afterend",
        previousResultArea
      );


      updatePreviousResultArea();
    }


    function updatePreviousResultArea() {

      if (!previousResultArea) {
        return;
      }


      const saved =
        loadLastResult();


      if (!saved) {

        previousResultArea.innerHTML =
          "";

        return;
      }


      const completedText =
        formatCompletedAt(
          saved.completedAt
        );


      previousResultArea.innerHTML = `

        <button
          id="previous-result-button"
          class="previous-result-card"
          type="button"
        >

          <div class="previous-result-head">

            <span class="previous-result-kicker">
              LAST RESULT
            </span>

            ${
              completedText
                ? `
                  <span class="previous-result-date">
                    ${escapeHtml(completedText)}
                  </span>
                `
                : ""
            }

          </div>


          <div class="previous-result-main">

            <div class="previous-result-score">

              <span class="previous-result-score-value">
                ${saved.score}
              </span>

              <span class="previous-result-score-total">
                /
                ${saved.total}
              </span>

            </div>


            <div class="previous-result-rank-block">

              <span class="previous-result-rank">
                ${escapeHtml(saved.rank)}
              </span>

              <span class="previous-result-title">
                ${escapeHtml(saved.title)}
              </span>

            </div>

          </div>


          <div class="previous-result-footer">
            前回の結果を見る

            <span aria-hidden="true">
              →
            </span>

          </div>

        </button>

      `;


      const button =
        document.querySelector(
          "#previous-result-button"
        );


      if (button) {

        button.addEventListener(
          "click",
          showPreviousResult
        );
      }
    }


    /* =========================
       前回結果保存
    ========================= */

    function saveLastResult(
      rankResult
    ) {

      try {

        const data = {

          version:
            STORAGE_SCHEMA_VERSION,

          questionSetVersion:
            QUESTION_SET_VERSION,

          categoryStatsVersion:
            CATEGORY_STATS_VERSION,

          score:
            score,

          total:
            quizQuestions.length,

          rank:
            rankResult.rank,

          title:
            rankResult.title,

          comment:
            rankResult.comment,

          categoryStats:
            categoryStats,

          categoryStatsComplete:
            categoryStatsComplete,

          completedAt:
            new Date().toISOString()
        };


        localStorage.setItem(
          QUIZ_LAST_RESULT_KEY,
          JSON.stringify(data)
        );


        updatePreviousResultArea();


      } catch (error) {

        console.error(
          "前回結果保存エラー:",
          error
        );
      }
    }


    /* =========================
       前回結果読込
    ========================= */

    function loadLastResult() {

      try {

        const raw =
          localStorage.getItem(
            QUIZ_LAST_RESULT_KEY
          );


        if (!raw) {
          return null;
        }


        let data =
          JSON.parse(raw);


        if (
          data &&
          data.version === 1
        ) {

          data = {

            ...data,

            version:
              2,

            questionSetVersion:
              1,

            categoryStatsVersion:
              1,

            categoryStatsComplete:
              typeof data.categoryStatsComplete ===
              "boolean"
                ? data.categoryStatsComplete
                : true
          };


          localStorage.setItem(
            QUIZ_LAST_RESULT_KEY,
            JSON.stringify(data)
          );
        }


        if (
          !data ||
          data.version !==
            STORAGE_SCHEMA_VERSION ||
          typeof data.score !==
            "number" ||
          typeof data.total !==
            "number" ||
          typeof data.rank !==
            "string" ||
          typeof data.title !==
            "string"
        ) {

          return null;
        }


        return data;


      } catch (error) {

        console.error(
          "前回結果読込エラー:",
          error
        );

        return null;
      }
    }


    /* =========================
       前回結果表示
    ========================= */

    function showPreviousResult() {

      const saved =
        loadLastResult();


      if (!saved) {

        updatePreviousResultArea();

        return;
      }


      const rankResult = {

        rank:
          saved.rank,

        title:
          saved.title,

        comment:
          saved.comment || ""
      };


      renderMainResultScreen(
        {

          scoreValue:
            saved.score,

          totalValue:
            saved.total,

          rankResult:
            rankResult,

          statsSource:
            saved.categoryStats || {},

          statsComplete:
            typeof saved.categoryStatsComplete ===
            "boolean"
              ? saved.categoryStatsComplete
              : true,

          resultTest:
            false
        }
      );
    }


    /* =========================
       前回結果テスト
    ========================= */

    function runLastResultTest() {

      try {

        const dummyScore =
          69;

        const rankResult =
          getRankResult(
            dummyScore
          );


        const dummyData = {

          version:
            STORAGE_SCHEMA_VERSION,

          questionSetVersion:
            QUESTION_SET_VERSION,

          categoryStatsVersion:
            CATEGORY_STATS_VERSION,

          score:
            69,

          total:
            100,

          rank:
            rankResult.rank,

          title:
            rankResult.title,

          comment:
            rankResult.comment,

          categoryStats: {

            モンスター: {
              correct: 14,
              total: 20
            },

            アイテム: {
              correct: 17,
              total: 25
            },

            ダンジョン: {
              correct: 12,
              total: 15
            },

            仕様: {
              correct: 20,
              total: 30
            },

            その他: {
              correct: 6,
              total: 10
            }
          },

          categoryStatsComplete:
            true,

          completedAt:
            new Date().toISOString()
        };


        localStorage.setItem(
          QUIZ_LAST_RESULT_KEY,
          JSON.stringify(dummyData)
        );


        window.location.replace(
          window.location.pathname
        );


      } catch (error) {

        console.error(
          "前回結果テスト保存エラー:",
          error
        );


        alert(
          "ダミーの前回結果を保存できませんでした。"
        );
      }
    }


    /* =========================
       日時表示
    ========================= */

    function formatCompletedAt(
      value
    ) {

      if (!value) {
        return "";
      }


      const date =
        new Date(value);


      if (
        Number.isNaN(
          date.getTime()
        )
      ) {

        return "";
      }


      return new Intl.DateTimeFormat(
        "ja-JP",
        {
          year:
            "numeric",

          month:
            "numeric",

          day:
            "numeric",

          hour:
            "2-digit",

          minute:
            "2-digit"
        }
      ).format(date);
    }


    function goToTop() {

      window.location.href =
        window.location.pathname;
    }


    /* =========================
       クイズ開始
    ========================= */

    async function startQuiz(
      questionCount = 100,
      mode = "main"
    ) {

      quizMode =
        mode;


      try {

        const allQuestions =
          await loadQuestionsData();


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


        currentQuestionIndex =
          0;

        score =
          0;

        categoryStats =
          {};

        categoryStatsComplete =
          true;

        answerLocked =
          false;

        quizSessionId =
          null;


        if (
          shouldTrackAnalytics()
        ) {

          quizSessionId =
            await createQuizSession(
              quizMode,
              quizQuestions.length,
              0,
              0
            );
        }


        if (
          quizMode ===
            "main"
        ) {

          saveProgress(
            0
          );
        }


        showQuestion();


      } catch (error) {

        showQuestionDataError(
          error
        );
      }
    }


    /* =========================
       問題表示
    ========================= */

    function showQuestion() {

      answerLocked =
        false;


      if (
        quizMode ===
          "main"
      ) {

        saveProgress(
          currentQuestionIndex
        );
      }


      const question =
        quizQuestions[
          currentQuestionIndex
        ];


      if (!question) {

        showQuestionDataError(
          new Error(
            "表示する問題データが見つかりません。"
          )
        );

        return;
      }


      const progress =
        (
          (
            currentQuestionIndex +
            1
          ) /
          quizQuestions.length
        ) *
        100;


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
              ${escapeHtml(
                question.category
              )}
            </span>

          </div>

        </div>


        <div class="progress-wrap">

          <div
            class="progress-bar"
            style="width:${progress}%;"
          ></div>

        </div>


        ${
          quizMode ===
            "main"

            ? `

              <div class="pause-row">

                <button
                  class="pause-button"
                  type="button"
                >
                  中断してトップへ戻る
                </button>

              </div>

            `

            : ""
        }


        <h2>
          ${escapeHtml(
            question.question
          )}
        </h2>


        ${
          question.type ===
            "multiple" &&
          question.instruction

            ? `

              <div class="question-instruction">
                ${escapeHtml(
                  question.instruction
                )}
              </div>

            `

            : ""
        }


        <div class="choices">

          ${question.choices
            .map(
              function (
                choice,
                index
              ) {

                return `

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
                      ${escapeHtml(choice)}
                    </span>

                  </button>

                `;
              }
            )
            .join("")}

        </div>


        ${
          question.type ===
            "multiple"

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


      const pauseButton =
        document.querySelector(
          ".pause-button"
        );


      if (pauseButton) {

        pauseButton.addEventListener(
          "click",
          goToTop
        );
      }


      if (
        question.type ===
          "multiple"
      ) {

        const selectedAnswers =
          new Set();


        const submitButton =
          document.querySelector(
            ".submit-answer-button"
          );


        choiceButtons.forEach(
          function (
            button
          ) {

            button.addEventListener(
              "click",
              function () {

                if (
                  answerLocked
                ) {

                  return;
                }


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


                  button
                    .classList
                    .remove(
                      "selected"
                    );


                } else {

                  selectedAnswers.add(
                    selectedIndex
                  );


                  button
                    .classList
                    .add(
                      "selected"
                    );
                }


                submitButton.disabled =
                  selectedAnswers.size ===
                  0;
              }
            );
          }
        );


        submitButton.addEventListener(
          "click",
          function () {

            if (
              answerLocked
            ) {

              return;
            }


            const answers =
              Array.from(
                selectedAnswers
              ).sort(
                function (
                  a,
                  b
                ) {

                  return a - b;
                }
              );


            checkAnswer(
              answers
            );
          }
        );


      } else {

        choiceButtons.forEach(
          function (
            button
          ) {

            button.addEventListener(
              "click",
              function () {

                if (
                  answerLocked
                ) {

                  return;
                }


                checkAnswer(
                  Number(
                    button.dataset.index
                  )
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

    function checkAnswer(
      selectedAnswer
    ) {

      if (
        answerLocked
      ) {

        return;
      }


      answerLocked =
        true;


      const answeredQuestionIndex =
        currentQuestionIndex;


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


      const submitButton =
        document.querySelector(
          ".submit-answer-button"
        );


      if (
        submitButton
      ) {

        submitButton.disabled =
          true;
      }


      const correctAnswers =
        Array.isArray(
          question.answer
        )

          ? [...question.answer]
              .sort(
                function (
                  a,
                  b
                ) {

                  return a - b;
                }
              )

          : [
              question.answer
            ];


      const selectedAnswers =
        Array.isArray(
          selectedAnswer
        )

          ? [...selectedAnswer]
              .sort(
                function (
                  a,
                  b
                ) {

                  return a - b;
                }
              )

          : [
              selectedAnswer
            ];


      const isCorrect =
        selectedAnswers.length ===
          correctAnswers.length

        &&

        selectedAnswers.every(
          function (
            answer,
            index
          ) {

            return (
              answer ===
              correctAnswers[
                index
              ]
            );
          }
        );


      if (
        isCorrect
      ) {

        score++;
      }


      if (
        quizMode ===
          "main"
      ) {

        updateCategoryStats(
          question.category,
          isCorrect
        );


        saveProgress(
          currentQuestionIndex +
          1
        );
      }


      choiceButtons.forEach(
        function (
          button
        ) {

          button.disabled =
            true;


          const choiceIndex =
            Number(
              button.dataset.index
            );


          if (
            correctAnswers.includes(
              choiceIndex
            )
          ) {

            button
              .classList
              .add(
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

            button
              .classList
              .add(
                "incorrect"
              );
          }
        }
      );


      const statsPromise =
        saveFirstAnswer(
          question.id,
          selectedAnswer,
          isCorrect
        );


      if (
        shouldTrackAnalytics() &&
        quizSessionId
      ) {

        recordQuizAnswer(
          quizSessionId,
          question.id,
          currentQuestionIndex + 1,
          question.category,
          selectedAnswer,
          isCorrect
        );


        updateQuizSessionProgress(
          quizSessionId,
          currentQuestionIndex + 1,
          score
        );
      }


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
          class="
            result-box
            ${resultClass}
          "
        >

          <div class="result-title">
            ${resultTitle}
          </div>


          <div class="correct-answer">

            <span class="correct-answer-title">
              正解
            </span>


            ${correctAnswers
              .map(
                function (
                  answerIndex
                ) {

                  return `

                    <span class="correct-answer-label">
                      ${String.fromCharCode(
                        65 + answerIndex
                      )}
                    </span>

                    <span class="correct-answer-text">
                      ${escapeHtml(
                        question.choices[
                          answerIndex
                        ]
                      )}
                    </span>

                  `;
                }
              )
              .join("")}

          </div>


          <div class="explanation-title">
            解説
          </div>


          <p class="explanation">
            ${escapeHtml(
              question.explanation
            )}
          </p>


          <div
            class="
              community-stats
              community-stats-slot
            "
          >

            <div class="community-stats-title">
              みんなの正答率
            </div>

            <div class="community-stats-detail">
              読み込み中...
            </div>

          </div>


          <div class="current-score">

            <span class="current-score-label">
              現在の成績
            </span>

            <span class="current-score-number">
              ${score}
              /
              ${currentQuestionIndex + 1}
            </span>

          </div>


          <div class="report-section">

            <button class="report-toggle-button">
              この問題に物申す
            </button>


            <div
              class="
                report-form
                hidden
              "
            >

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


        <button
          class="
            next-button
            answer-next-button
          "
        >

          ${
            currentQuestionIndex + 1 <
              quizQuestions.length

              ? "次の問題へ"

              : "結果を見る"
          }

        </button>

      `;


      const resultBox =
        document.querySelector(
          ".result-box"
        );


      if (
        resultBox
      ) {

        setTimeout(
          function () {

            resultBox.scrollIntoView(
              {
                behavior:
                  "smooth",

                block:
                  "center"
              }
            );

          },
          80
        );
      }


      document
        .querySelector(
          ".answer-next-button"
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


      const reportSubmitButton =
        document.querySelector(
          ".report-submit-button"
        );


      reportToggleButton.addEventListener(
        "click",
        function () {

          reportForm
            .classList
            .toggle(
              "hidden"
            );
        }
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


          if (
            !reportType
          ) {

            reportStatus.textContent =
              "指摘内容を選んでください。";

            reportStatus.className =
              "report-status error";

            return;
          }


          if (
            !message
          ) {

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


          if (
            success
          ) {

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


      statsPromise.then(
        function (
          stats
        ) {

          if (
            currentQuestionIndex !==
              answeredQuestionIndex
          ) {

            return;
          }


          const statsSlot =
            document.querySelector(
              ".community-stats-slot"
            );


          if (
            !statsSlot
          ) {

            return;
          }


          if (
            !stats
          ) {

            statsSlot.innerHTML = `

              <div class="community-stats-title">
                みんなの正答率
              </div>

              <div class="community-stats-detail">
                正答率を取得できませんでした
              </div>

            `;

            return;
          }


          statsSlot.innerHTML = `

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

          `;
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


        requestAnimationFrame(
          function () {

            window.scrollTo(
              {
                top:
                  0,

                behavior:
                  "auto"
              }
            );
          }
        );
      }
    }


    /* =========================
       問題データ読込
    ========================= */

    async function loadQuestionsData() {

      const pageSize =
        1000;


      let from =
        0;


      const allQuestions =
        [];


      while (
        true
      ) {

        const {
          data,
          error
        } =

          await supabaseClient
            .from(
              "questions"
            )
            .select(
              "id,category,type,instruction,question,choices,answer,explanation,tags"
            )
            .eq(
              "is_published",
              true
            )
            .order(
              "id",
              {
                ascending:
                  true
              }
            )
            .range(
              from,
              from +
              pageSize -
              1
            );


        if (
          error
        ) {

          console.error(
            "問題データ取得エラー:",
            error
          );


          throw new Error(
            "Supabaseから問題データを取得できませんでした。"
          );
        }


        if (
          !Array.isArray(
            data
          )
        ) {

          throw new Error(
            "問題データの形式が不正です。"
          );
        }


        const normalized =
          data.map(
            function (
              question
            ) {

              return {

                ...question,

                instruction:
                  question.instruction ??
                  "",

                explanation:
                  question.explanation ??
                  "",

                tags:
                  Array.isArray(
                    question.tags
                  )
                    ? question.tags
                    : []
              };
            }
          );


        allQuestions.push(
          ...normalized
        );


        if (
          data.length <
          pageSize
        ) {

          break;
        }


        from +=
          pageSize;
      }


      validateQuestionsData(
        allQuestions
      );


      return allQuestions;
    }


    /* =========================
       問題データ検証
    ========================= */

    function validateQuestionsData(
      data
    ) {

      const errors =
        [];


      if (
        !Array.isArray(
          data
        )
      ) {

        throw new Error(
          "問題データの最上位は配列である必要があります。"
        );
      }


      if (
        data.length ===
          0
      ) {

        throw new Error(
          "公開中の問題が1問もありません。"
        );
      }


      const seenIds =
        new Set();


      data.forEach(
        function (
          question,
          index
        ) {

          const rowLabel =
            `データ${index + 1}件目`;


          if (
            !question ||
            typeof question !==
              "object" ||
            Array.isArray(
              question
            )
          ) {

            errors.push(
              `${rowLabel}: 問題データが不正です。`
            );

            return;
          }


          const questionId =
            question.id;


          const hasId =
            questionId !==
              undefined &&
            questionId !==
              null &&
            String(
              questionId
            ).trim() !==
              "";


          const idLabel =
            hasId
              ? `問題ID #${questionId}`
              : rowLabel;


          if (
            !hasId
          ) {

            errors.push(
              `${rowLabel}: id がありません。`
            );


          } else {

            const normalizedId =
              String(
                questionId
              );


            if (
              seenIds.has(
                normalizedId
              )
            ) {

              errors.push(
                `${idLabel}: id が重複しています。`
              );


            } else {

              seenIds.add(
                normalizedId
              );
            }
          }


          if (
            !VALID_QUESTION_CATEGORIES.includes(
              question.category
            )
          ) {

            errors.push(
              `${idLabel}: category「${question.category}」は無効です。`
            );
          }


          if (
            !VALID_QUESTION_TYPES.includes(
              question.type
            )
          ) {

            errors.push(
              `${idLabel}: type「${question.type}」は無効です。`
            );
          }


          if (
            typeof question.question !==
              "string" ||
            question.question
              .trim() ===
              ""
          ) {

            errors.push(
              `${idLabel}: question が空です。`
            );
          }


          if (
            !Array.isArray(
              question.choices
            )
          ) {

            errors.push(
              `${idLabel}: choices が配列ではありません。`
            );

            return;
          }


          if (
            question.choices.length <
              2 ||
            question.choices.length >
              4
          ) {

            errors.push(
              `${idLabel}: choices は2～4個にしてください。`
            );
          }


          question.choices.forEach(
            function (
              choice,
              choiceIndex
            ) {

              if (
                typeof choice !==
                  "string" ||
                choice.trim() ===
                  ""
              ) {

                errors.push(
                  `${idLabel}: 選択肢${String.fromCharCode(
                    65 + choiceIndex
                  )}が空です。`
                );
              }
            }
          );


          const isValidAnswerIndex =
            function (
              answer
            ) {

              return (
                Number.isInteger(
                  answer
                ) &&
                answer >= 0 &&
                answer <
                  question
                    .choices
                    .length
              );
            };


          if (
            question.type ===
              "single" &&
            !isValidAnswerIndex(
              question.answer
            )
          ) {

            errors.push(
              `${idLabel}: answer が選択肢の範囲外です。`
            );
          }


          if (
            question.type ===
              "multiple"
          ) {

            if (
              !Array.isArray(
                question.answer
              ) ||
              question.answer.length ===
                0
            ) {

              errors.push(
                `${idLabel}: multiple の answer が不正です。`
              );


            } else {

              const uniqueAnswers =
                new Set(
                  question.answer
                );


              if (
                uniqueAnswers.size !==
                  question.answer.length
              ) {

                errors.push(
                  `${idLabel}: answer に重複があります。`
                );
              }


              question.answer.forEach(
                function (
                  answer
                ) {

                  if (
                    !isValidAnswerIndex(
                      answer
                    )
                  ) {

                    errors.push(
                      `${idLabel}: answer「${answer}」が範囲外です。`
                    );
                  }
                }
              );
            }
          }


          if (
            typeof question.explanation !==
              "string"
          ) {

            errors.push(
              `${idLabel}: explanation が文字列ではありません。`
            );
          }
        }
      );


      if (
        errors.length >
          0
      ) {

        throw new Error(
          errors
            .slice(
              0,
              20
            )
            .join(
              "\n"
            )
        );
      }
    }


    /* =========================
       データエラー画面
    ========================= */

    function showQuestionDataError(
      error,
      showDetail = false
    ) {

      console.error(
        "問題データエラー:",
        error
      );


      const safeMessage =
        error &&
        error.message
          ? String(
              error.message
            )
          : "不明なエラー";


      quizCard.innerHTML = `

        <div class="result-screen">

          <p class="hero-label">
            ERROR
          </p>

          <h1>
            問題データエラー
          </h1>

          <p>
            ${escapeHtml(
              safeMessage
            )}
          </p>


          ${
            showDetail

              ? `

                <pre>
${escapeHtml(
  safeMessage
)}
                </pre>

              `

              : ""
          }


          <button
            class="
              restart-button
              data-reload-button
            "
            type="button"
          >
            トップ画面へ戻る
          </button>

        </div>

      `;


      const reloadButton =
        document.querySelector(
          ".data-reload-button"
        );


      if (
        reloadButton
      ) {

        reloadButton.addEventListener(
          "click",
          goToTop
        );
      }
    }


    /* =========================
       問題データ検証テスト
    ========================= */

    function runDataValidationTest() {

      loadQuestionsData()
        .then(
          function (
            data
          ) {

            quizCard.innerHTML = `

              <div class="result-screen">

                <h1>
                  問題データチェックOK
                </h1>

                <p>
                  ${data.length}問読み込みました。
                </p>

              </div>

            `;
          }
        )
        .catch(
          function (
            error
          ) {

            showQuestionDataError(
              error,
              true
            );
          }
        );
    }


    /* =========================
       結果画面テスト
    ========================= */

    function showResultTest() {

      const testScore =
        69;


      const testStats = {

        モンスター: {
          correct: 14,
          total: 20
        },

        アイテム: {
          correct: 17,
          total: 25
        },

        ダンジョン: {
          correct: 12,
          total: 15
        },

        仕様: {
          correct: 20,
          total: 30
        },

        その他: {
          correct: 6,
          total: 10
        }
      };


      const rankResult =
        getRankResult(
          testScore
        );


      renderMainResultScreen(
        {

          scoreValue:
            testScore,

          totalValue:
            100,

          rankResult:
            rankResult,

          statsSource:
            testStats,

          statsComplete:
            true,

          resultTest:
            true
        }
      );
    }


    /* =========================
       結果
    ========================= */

    function showResult() {

      if (
        shouldTrackAnalytics() &&
        quizSessionId
      ) {

        const completedSessionId =
          quizSessionId;


        quizSessionId =
          null;


        completeQuizSession(
          completedSessionId,
          quizQuestions.length,
          score
        );
      }


      if (
        quizMode ===
          "trial"
      ) {

        const percentage =
          Math.round(
            (
              score /
              quizQuestions.length
            ) *
            100
          );


        showTrialResult(
          percentage
        );

        return;
      }


      const rankResult =
        getRankResult(
          score
        );


      const isOfficialFullCompletion =
        quizMode ===
          "main" &&
        !isTestMode &&
        !isResultTestMode &&
        !isDataTestMode &&
        !isLastResultTestMode &&
        quizQuestions.length ===
          100;


      if (
        isOfficialFullCompletion
      ) {

        saveLastResult(
          rankResult
        );
      }


      if (
        !isResultTestMode
      ) {

        clearProgress();
      }


      renderMainResultScreen(
        {

          scoreValue:
            score,

          totalValue:
            quizQuestions.length,

          rankResult:
            rankResult,

          statsSource:
            categoryStats,

          statsComplete:
            categoryStatsComplete,

          resultTest:
            false,

          showCompletion:
            isOfficialFullCompletion
        }
      );
    }


    /* =========================
       本番結果表示
    ========================= */

    function renderMainResultScreen(
      {

        scoreValue,
        totalValue,
        rankResult,
        statsSource,
        statsComplete,
        resultTest = false,
        showCompletion = false
      }
    ) {

      const percentage =
        Math.round(
          (
            scoreValue /
            totalValue
          ) *
          100
        );


      const canShareResult =
        totalValue === 100;


      quizCard.innerHTML = `

        <div class="result-screen">

          <p class="hero-label">
            ${
              resultTest
                ? "RESULT TEST"
                : "RESULT"
            }
          </p>


          <div class="result-brand">

            <div class="result-brand-title">

              <span class="title-asuka">
                アスカ見参
              </span>

              <span class="title-haijin">
                廃人検定
              </span>

            </div>


            <h1 class="result-heading">
              検定結果
            </h1>

          </div>


          <div class="final-score">

            ${scoreValue}

            <span>
              /
              ${totalValue}
            </span>

          </div>


          <div class="percentage">
            正答率
            ${percentage}%
          </div>


          ${
            showCompletion

              ? `

                <div class="full-completion-badge">

                  <span class="full-completion-en">
                    ALL 100 QUESTIONS COMPLETE
                  </span>

                  <span class="full-completion-title">
                    100問完走
                  </span>

                </div>

              `

              : ""
          }


          <div class="rank-panel">

            <div class="rank-label">
              あなたのランク・称号
            </div>

            <div class="rank-grade">
              ${escapeHtml(
                rankResult.rank
              )}
            </div>

            <div class="rank">
              ${escapeHtml(
                rankResult.title
              )}
            </div>

            <div class="rank-comment">
              ${rankResult.comment}
            </div>

          </div>


          ${renderCategoryStatsFromData(
            statsSource,
            statsComplete
          )}


          ${
            canShareResult

              ? `

                <button
                  class="
                    next-button
                    result-share-button
                  "
                  type="button"
                >
                  <span
                    style="
                      display:inline-flex;
                      align-items:center;
                      justify-content:center;
                      gap:10px;
                    "
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      aria-hidden="true"
                      focusable="false"
                      style="
                        display:block;
                        fill:currentColor;
                        flex:0 0 auto;
                      "
                    >
                      <path
                        d="M18.244 2H21.5l-7.1 8.114L22.75 22h-6.54l-5.12-6.71L5.33 22H2.07l7.6-8.69L1.25 2h6.71l4.63 6.12L18.244 2Zm-1.15 18h1.8L6.38 3.9H4.48L17.094 20Z"
                      ></path>
                    </svg>

                    <span>
                      結果をシェア
                    </span>
                  </span>
                </button>


                <div
                  class="result-share-status"
                  aria-live="polite"
                  style="
                    min-height: 1.5em;
                    margin-top: 10px;
                    font-size: 0.9rem;
                    opacity: 0.82;
                  "
                ></div>

              `

              : ""
          }


          <button
            class="
              restart-button
              result-top-button
            "
            type="button"
          >
            トップ画面へ戻る
          </button>

        </div>

      `;


      const topButton =
        document.querySelector(
          ".result-top-button"
        );


      if (
        topButton
      ) {

        topButton.addEventListener(
          "click",
          goToTop
        );
      }


      const shareButton =
        document.querySelector(
          ".result-share-button"
        );


      const shareStatus =
        document.querySelector(
          ".result-share-status"
        );


      if (
        shareButton
      ) {

        shareButton.addEventListener(
          "click",
          async function () {

            const originalHtml =
              shareButton.innerHTML;


            shareButton.disabled =
              true;

            shareButton.textContent =
              "結果画像を作成中...";


            if (
              shareStatus
            ) {

              shareStatus.textContent =
                "X投稿用の結果カードを作成しています。";
            }


            try {

              const shareMode =
                await shareQuizResult(
                  {
                    scoreValue,
                    totalValue,
                    rankResult,
                    statsSource,
                    statsComplete
                  }
                );


              if (
                shareStatus
              ) {

                if (
                  shareMode ===
                    "native-share"
                ) {

                  shareStatus.textContent =
                    "共有画面を開きました。Xを選んで投稿してください。";

                } else if (
                  shareMode ===
                    "desktop-clipboard"
                ) {

                  shareStatus.textContent =
                    "結果画像をコピーしました。Xの投稿画面で Ctrl+V を押してください。";

                } else {

                  shareStatus.textContent =
                    "結果画像を保存しました。Xの投稿画面で画像を添付してください。";
                }
              }


            } catch (error) {

              if (
                error &&
                error.name ===
                  "AbortError"
              ) {

                if (
                  shareStatus
                ) {

                  shareStatus.textContent =
                    "共有をキャンセルしました。";
                }


              } else {

                console.error(
                  "結果共有エラー:",
                  error
                );


                if (
                  shareStatus
                ) {

                  shareStatus.textContent =
                    "共有できませんでした。もう一度お試しください。";
                }
              }


            } finally {

              shareButton.disabled =
                false;

              shareButton.innerHTML =
                originalHtml;
            }
          }
        );
      }
    }


    /* =========================
       X結果シェア
    ========================= */

    async function shareQuizResult(
      {
        scoreValue,
        totalValue,
        rankResult,
        statsSource,
        statsComplete
      }
    ) {

      const shareUrl =
        `${window.location.origin}${window.location.pathname}`;


      const shareText =
        `アスカ見参 廃人検定\n` +
        `${scoreValue} / ${totalValue}点\n` +
        `${rankResult.rank}「${rankResult.title}」\n\n` +
        `あなたは何点取れる？\n` +
        `#アスカ見参 #アスカ見参廃人検定`;


      const intentUrl =
        "https://x.com/intent/tweet" +
        `?text=${encodeURIComponent(shareText)}` +
        `&url=${encodeURIComponent(shareUrl)}`;


      const canvas =
        createResultShareCanvas(
          {
            scoreValue,
            totalValue,
            rankResult,
            statsSource,
            statsComplete,
            shareUrl
          }
        );


      const blob =
        await canvasToBlob(
          canvas
        );


      const file =
        new File(
          [blob],
          `asuka-haijin-kentei-${scoreValue}.png`,
          {
            type:
              "image/png"
          }
        );


      const shareData = {

        title:
          "アスカ見参 廃人検定",

        text:
          shareText,

        url:
          shareUrl,

        files: [
          file
        ]
      };


      const isMobile =
        isMobileShareEnvironment();


      if (
        isMobile &&
        navigator.share &&
        navigator.canShare &&
        navigator.canShare(
          {
            files: [
              file
            ]
          }
        )
      ) {

        await navigator.share(
          shareData
        );

        return "native-share";
      }


      const copied =
        await copyResultImageToClipboard(
          blob
        );


      if (
        copied
      ) {

        alert(
          "結果画像をクリップボードにコピーしました。\n\nこれからXの投稿画面を開きます。\n投稿画面で Ctrl+V を押すと画像を添付できます。"
        );

        openXIntent(
          intentUrl
        );

        return "desktop-clipboard";
      }


      downloadResultImage(
        blob,
        file.name
      );


      alert(
        "このブラウザでは画像をクリップボードへコピーできなかったため、結果画像をPNGで保存しました。\n\nこれからXの投稿画面を開きます。保存した画像を添付してください。"
      );


      openXIntent(
        intentUrl
      );


      return "desktop-download";
    }


    function isMobileShareEnvironment() {

      if (
        navigator.userAgentData &&
        typeof navigator.userAgentData.mobile ===
          "boolean"
      ) {

        return navigator.userAgentData.mobile;
      }


      const userAgent =
        navigator.userAgent ||
        "";


      if (
        /Android|iPhone|iPod|Mobile/i.test(
          userAgent
        )
      ) {

        return true;
      }


      if (
        /iPad/i.test(
          userAgent
        )
      ) {

        return true;
      }


      if (
        /Macintosh/i.test(
          userAgent
        ) &&
        navigator.maxTouchPoints >
          1
      ) {

        return true;
      }


      return false;
    }


    async function copyResultImageToClipboard(
      blob
    ) {

      if (
        !navigator.clipboard ||
        typeof navigator.clipboard.write !==
          "function" ||
        typeof ClipboardItem ===
          "undefined"
      ) {

        return false;
      }


      try {

        const clipboardItem =
          new ClipboardItem(
            {
              "image/png":
                blob
            }
          );


        await navigator.clipboard.write(
          [
            clipboardItem
          ]
        );


        return true;


      } catch (error) {

        console.warn(
          "結果画像のクリップボードコピーに失敗しました:",
          error
        );

        return false;
      }
    }


    function openXIntent(
      intentUrl
    ) {

      const openedWindow =
        window.open(
          intentUrl,
          "_blank"
        );


      if (
        !openedWindow
      ) {

        window.location.href =
          intentUrl;
      }
    }


    function createResultShareCanvas(
      {
        scoreValue,
        totalValue,
        rankResult,
        statsSource,
        statsComplete,
        shareUrl
      }
    ) {

      const canvas =
        document.createElement(
          "canvas"
        );


      canvas.width =
        1200;

      canvas.height =
        630;


      const ctx =
        canvas.getContext(
          "2d"
        );


      const background =
        ctx.createLinearGradient(
          0,
          0,
          1200,
          630
        );


      background.addColorStop(
        0,
        "#0b0d12"
      );

      background.addColorStop(
        0.58,
        "#15131a"
      );

      background.addColorStop(
        1,
        "#21170d"
      );


      ctx.fillStyle =
        background;

      ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );


      const gold =
        "#e5bd55";

      const goldSoft =
        "#b9923f";

      const white =
        "#f6f2e8";

      const muted =
        "#b9b3a9";

      const panel =
        "rgba(255,255,255,0.055)";


      ctx.strokeStyle =
        "rgba(229,189,85,0.55)";

      ctx.lineWidth =
        2;

      roundRect(
        ctx,
        26,
        26,
        1148,
        578,
        28
      );

      ctx.stroke();


      ctx.fillStyle =
        goldSoft;

      ctx.font =
        '700 22px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';

      ctx.textAlign =
        "left";

      ctx.fillText(
        "ASUKA KENZAN",
        70,
        78
      );


      ctx.fillStyle =
        white;

      ctx.font =
        '800 43px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';

      ctx.fillText(
        "アスカ見参 廃人検定",
        70,
        126
      );


      ctx.fillStyle =
        muted;

      ctx.font =
        '600 18px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';

      ctx.fillText(
        "全100問・アスカ見参ガチ勢向け知識検定",
        72,
        158
      );


      ctx.fillStyle =
        panel;

      roundRect(
        ctx,
        65,
        194,
        460,
        280,
        26
      );

      ctx.fill();


      ctx.fillStyle =
        muted;

      ctx.font =
        '700 20px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';

      ctx.textAlign =
        "center";

      ctx.fillText(
        "SCORE",
        295,
        235
      );


      ctx.fillStyle =
        white;

      ctx.font =
        '900 126px "Arial", "Yu Gothic", sans-serif';

      ctx.fillText(
        String(
          scoreValue
        ),
        250,
        365
      );


      ctx.fillStyle =
        gold;

      ctx.font =
        '800 42px "Arial", "Yu Gothic", sans-serif';

      ctx.fillText(
        `/ ${totalValue}`,
        405,
        363
      );


      ctx.fillStyle =
        "rgba(229,189,85,0.15)";

      roundRect(
        ctx,
        605,
        194,
        525,
        138,
        24
      );

      ctx.fill();


      ctx.fillStyle =
        gold;

      ctx.font =
        '900 66px "Arial", "Yu Gothic", sans-serif';

      ctx.textAlign =
        "left";

      ctx.fillText(
        rankResult.rank,
        640,
        270
      );


      ctx.fillStyle =
        white;

      ctx.font =
        '800 28px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';

      drawFittedText(
        ctx,
        rankResult.title,
        770,
        265,
        320,
        28,
        21
      );


      ctx.fillStyle =
        panel;

      roundRect(
        ctx,
        605,
        350,
        525,
        124,
        24
      );

      ctx.fill();


      ctx.fillStyle =
        white;

      ctx.font =
        '800 31px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';

      ctx.textAlign =
        "center";

      ctx.fillText(
        "あなたは何点取れる？",
        867,
        402
      );


      ctx.fillStyle =
        gold;

      ctx.font =
        '700 20px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';

      ctx.fillText(
        "挑戦者、求む。",
        867,
        440
      );


      if (
        statsComplete &&
        statsSource &&
        typeof statsSource ===
          "object"
      ) {

        const categories =
          VALID_QUESTION_CATEGORIES
            .map(
              function (
                category
              ) {

                return [
                  category,
                  statsSource[
                    category
                  ]
                ];
              }
            )
            .filter(
              function (
                entry
              ) {

                return (
                  entry[1] &&
                  entry[1].total >
                    0
                );
              }
            );


        if (
          categories.length >
            0
        ) {

          const startX =
            70;

          const startY =
            515;

          const gap =
            212;


          categories
            .slice(
              0,
              5
            )
            .forEach(
              function (
                entry,
                index
              ) {

                const category =
                  entry[0];

                const stat =
                  entry[1];

                const accuracy =
                  Math.round(
                    (
                      stat.correct /
                      stat.total
                    ) *
                    100
                  );

                const x =
                  startX +
                  gap *
                  index;


                ctx.fillStyle =
                  muted;

                ctx.font =
                  '700 16px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';

                ctx.textAlign =
                  "left";

                ctx.fillText(
                  category,
                  x,
                  startY
                );


                ctx.fillStyle =
                  "rgba(255,255,255,0.12)";

                roundRect(
                  ctx,
                  x,
                  startY +
                    14,
                  145,
                  10,
                  5
                );

                ctx.fill();


                ctx.fillStyle =
                  gold;

                roundRect(
                  ctx,
                  x,
                  startY +
                    14,
                  145 *
                    Math.max(
                      0,
                      Math.min(
                        100,
                        accuracy
                      )
                    ) /
                    100,
                  10,
                  5
                );

                ctx.fill();


                ctx.fillStyle =
                  white;

                ctx.font =
                  '800 18px "Arial", "Yu Gothic", sans-serif';

                ctx.textAlign =
                  "right";

                ctx.fillText(
                  `${accuracy}%`,
                  x +
                    190,
                  startY +
                    23
                );
              }
            );
        }
      }


      ctx.fillStyle =
        muted;

      ctx.font =
        '600 17px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';

      ctx.textAlign =
        "left";

      ctx.fillText(
        "#アスカ見参  #廃人検定",
        70,
        592
      );


      ctx.textAlign =
        "right";

      ctx.fillText(
        formatShareHost(
          shareUrl
        ),
        1130,
        592
      );


      return canvas;
    }


    function canvasToBlob(
      canvas
    ) {

      return new Promise(
        function (
          resolve,
          reject
        ) {

          canvas.toBlob(
            function (
              blob
            ) {

              if (
                blob
              ) {

                resolve(
                  blob
                );


              } else {

                reject(
                  new Error(
                    "結果画像を作成できませんでした。"
                  )
                );
              }
            },
            "image/png"
          );
        }
      );
    }


    function downloadResultImage(
      blob,
      filename
    ) {

      const objectUrl =
        URL.createObjectURL(
          blob
        );


      const link =
        document.createElement(
          "a"
        );


      link.href =
        objectUrl;

      link.download =
        filename;


      document.body.appendChild(
        link
      );


      link.click();


      link.remove();


      setTimeout(
        function () {

          URL.revokeObjectURL(
            objectUrl
          );
        },
        1000
      );
    }


    function formatShareHost(
      value
    ) {

      try {

        return new URL(
          value
        ).host;


      } catch (error) {

        return "";
      }
    }


    function drawFittedText(
      ctx,
      text,
      x,
      y,
      maxWidth,
      startSize,
      minSize
    ) {

      let size =
        startSize;


      while (
        size >
          minSize
      ) {

        ctx.font =
          `800 ${size}px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif`;


        if (
          ctx.measureText(
            text
          ).width <=
            maxWidth
        ) {

          break;
        }


        size -=
          1;
      }


      ctx.fillText(
        text,
        x,
        y
      );
    }


    function roundRect(
      ctx,
      x,
      y,
      width,
      height,
      radius
    ) {

      const safeRadius =
        Math.min(
          radius,
          width /
            2,
          height /
            2
        );


      ctx.beginPath();

      ctx.moveTo(
        x +
          safeRadius,
        y
      );

      ctx.lineTo(
        x +
          width -
          safeRadius,
        y
      );

      ctx.quadraticCurveTo(
        x +
          width,
        y,
        x +
          width,
        y +
          safeRadius
      );

      ctx.lineTo(
        x +
          width,
        y +
          height -
          safeRadius
      );

      ctx.quadraticCurveTo(
        x +
          width,
        y +
          height,
        x +
          width -
          safeRadius,
        y +
          height
      );

      ctx.lineTo(
        x +
          safeRadius,
        y +
          height
      );

      ctx.quadraticCurveTo(
        x,
        y +
          height,
        x,
        y +
          height -
          safeRadius
      );

      ctx.lineTo(
        x,
        y +
          safeRadius
      );

      ctx.quadraticCurveTo(
        x,
        y,
        x +
          safeRadius,
        y
      );

      ctx.closePath();
    }


    /* =========================
       お試し結果
    ========================= */

    function showTrialResult(
      percentage
    ) {

      quizCard.innerHTML = `

        <div class="result-screen">

          <p class="hero-label">
            TRIAL RESULT
          </p>


          <div class="result-brand">

            <div class="result-brand-title">

              <span class="title-asuka">
                アスカ見参
              </span>

              <span class="title-haijin">
                廃人検定
              </span>

            </div>


            <h1 class="result-heading">
              お試し結果
            </h1>

          </div>


          <div class="final-score">

            ${score}

            <span>
              /
              ${quizQuestions.length}
            </span>

          </div>


          <div class="percentage">
            正答率
            ${percentage}%
          </div>


          <div class="trial-complete-panel">

            <div class="trial-complete-label">
              TRIAL COMPLETE
            </div>

            <div class="trial-complete-title">
              5問完走
            </div>

            <p class="trial-complete-text">
              ここまでは、まだウォーミングアップ。
              <br>
              正式なランク・称号は、
              <strong>全100問</strong>
              で決まります。
            </p>

            <p class="trial-complete-warning">
              あなたは本当にアスカを理解しているか？
            </p>

          </div>


          <button
            class="
              next-button
              main-challenge-button
              trial-main-cta
            "
            type="button"
          >

            <span class="trial-main-cta-main">
              廃人検定100問に挑戦する
            </span>

            <span class="trial-main-cta-sub">
              正式ランク・称号を判定
            </span>

          </button>


          <button
            class="
              trial-result-button
              trial-again-button
            "
            type="button"
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
          startMainQuizFromBeginning
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
       100問版を最初から開始
    ========================= */

    async function startMainQuizFromBeginning() {

      const saved =
        loadProgress();


      if (
        saved
      ) {

        const confirmed =
          confirm(
            "中断中の100問検定があります。途中データを削除して最初から始めますか？"
          );


        if (
          !confirmed
        ) {

          return;
        }


        if (
          saved.sessionId
        ) {

          await abandonQuizSession(
            saved.sessionId
          );
        }


        clearProgress();
      }


      await startQuiz(
        isTestMode
          ? 5
          : 100,
        "main"
      );
    }


    /* =========================
       中断データ保存
    ========================= */

    function saveProgress(
      nextQuestionIndex
    ) {

      if (
        quizMode !==
          "main" ||
        isResultTestMode ||
        isDataTestMode ||
        isLastResultTestMode
      ) {

        return;
      }


      try {

        const data = {

          version:
            STORAGE_SCHEMA_VERSION,

          questionSetVersion:
            QUESTION_SET_VERSION,

          categoryStatsVersion:
            CATEGORY_STATS_VERSION,

          questionIds:
            quizQuestions.map(
              function (
                question
              ) {

                return question.id;
              }
            ),

          currentQuestionIndex:
            nextQuestionIndex,

          score:
            score,

          categoryStats:
            categoryStats,

          categoryStatsComplete:
            categoryStatsComplete,

          sessionId:
            quizSessionId,

          savedAt:
            new Date().toISOString()
        };


        localStorage.setItem(
          QUIZ_SAVE_KEY,
          JSON.stringify(data)
        );


        updateResumeArea();


      } catch (error) {

        console.error(
          "途中データ保存エラー:",
          error
        );
      }
    }


    /* =========================
       中断データ読込
    ========================= */

    function loadProgress() {

      try {

        const raw =
          localStorage.getItem(
            QUIZ_SAVE_KEY
          );


        if (
          !raw
        ) {

          return null;
        }


        const data =
          JSON.parse(raw);


        if (
          !data ||
          data.version !==
            STORAGE_SCHEMA_VERSION ||
          !Array.isArray(
            data.questionIds
          ) ||
          data.questionIds.length ===
            0 ||
          typeof data.currentQuestionIndex !==
            "number" ||
          typeof data.score !==
            "number"
        ) {

          return null;
        }


        return data;


      } catch (error) {

        console.error(
          "途中データ読込エラー:",
          error
        );

        return null;
      }
    }


    /* =========================
       中断データ削除
    ========================= */

    function clearProgress() {

      try {

        localStorage.removeItem(
          QUIZ_SAVE_KEY
        );


      } catch (error) {

        console.error(
          "途中データ削除エラー:",
          error
        );
      }


      updateResumeArea();
    }


    /* =========================
       再開表示更新
    ========================= */

    function updateResumeArea() {

      if (
        !resumeArea ||
        !resumeDetail
      ) {

        return;
      }


      const saved =
        loadProgress();


      if (
        !saved
      ) {

        resumeArea
          .classList
          .add(
            "hidden"
          );


        if (
          heroButtons
        ) {

          heroButtons
            .classList
            .remove(
              "hidden"
            );
        }


        if (
          trialNote
        ) {

          trialNote
            .classList
            .remove(
              "hidden"
            );
        }


        return;
      }


      resumeArea
        .classList
        .remove(
          "hidden"
        );


      if (
        heroButtons
      ) {

        heroButtons
          .classList
          .add(
            "hidden"
          );
      }


      if (
        trialNote
      ) {

        trialNote
          .classList
          .add(
            "hidden"
          );
      }


      const total =
        saved.questionIds.length;


      resumeDetail.textContent =
        saved.currentQuestionIndex >=
          total

          ? `全${total}問回答済み・結果を見る`

          : `第${saved.currentQuestionIndex + 1}問から再開・現在 ${saved.score}点`;
    }


    /* =========================
       クイズ再開
    ========================= */

    async function resumeQuiz() {

      const saved =
        loadProgress();


      if (
        !saved
      ) {

        updateResumeArea();

        return;
      }


      try {

        const allQuestions =
          await loadQuestionsData();


        const questionMap =
          new Map(
            allQuestions.map(
              function (
                question
              ) {

                return [
                  String(
                    question.id
                  ),
                  question
                ];
              }
            )
          );


        const restoredQuestions =
          saved.questionIds.map(
            function (
              id
            ) {

              return questionMap.get(
                String(id)
              );
            }
          );


        if (
          restoredQuestions.some(
            function (
              question
            ) {

              return !question;
            }
          )
        ) {

          alert(
            "問題データが更新されたため、途中データを再開できません。最初から挑戦してください。"
          );


          if (
            saved.sessionId
          ) {

            await abandonQuizSession(
              saved.sessionId
            );
          }


          clearProgress();

          return;
        }


        quizQuestions =
          restoredQuestions;

        currentQuestionIndex =
          Math.max(
            0,
            saved.currentQuestionIndex
          );

        score =
          Math.max(
            0,
            saved.score
          );

        categoryStats =
          saved.categoryStats &&
          typeof saved.categoryStats ===
            "object"

            ? saved.categoryStats

            : {};

        categoryStatsComplete =
          typeof saved.categoryStatsComplete ===
            "boolean"

            ? saved.categoryStatsComplete

            : true;

        quizMode =
          "main";

        quizSessionId =
          saved.sessionId || null;


        if (
          shouldTrackAnalytics() &&
          !quizSessionId
        ) {

          quizSessionId =
            await createQuizSession(
              "main",
              quizQuestions.length,
              currentQuestionIndex,
              score
            );


          saveProgress(
            currentQuestionIndex
          );
        }


        if (
          currentQuestionIndex >=
            quizQuestions.length
        ) {

          showResult();


        } else {

          showQuestion();
        }


      } catch (error) {

        console.error(
          "再開エラー:",
          error
        );


        showQuestionDataError(
          error
        );
      }
    }


    /* =========================
       カテゴリ集計
    ========================= */

    function updateCategoryStats(
      category,
      isCorrect
    ) {

      const group =
        VALID_QUESTION_CATEGORIES.includes(
          category
        )

          ? category

          : "その他";


      if (
        !categoryStats[
          group
        ]
      ) {

        categoryStats[
          group
        ] = {

          correct:
            0,

          total:
            0
        };
      }


      categoryStats[
        group
      ].total++;


      if (
        isCorrect
      ) {

        categoryStats[
          group
        ].correct++;
      }
    }


    /* =========================
       カテゴリ結果表示
    ========================= */

    function renderCategoryStatsFromData(
      statsSource,
      statsComplete = true
    ) {

      if (
        !statsComplete
      ) {

        return "";
      }


      if (
        !statsSource ||
        typeof statsSource !==
          "object"
      ) {

        return "";
      }


      const entries =
        VALID_QUESTION_CATEGORIES
          .map(
            function (
              category
            ) {

              return [
                category,
                statsSource[
                  category
                ]
              ];
            }
          )
          .filter(
            function (
              entry
            ) {

              return (
                entry[1] &&
                entry[1].total >
                  0
              );
            }
          );


      if (
        entries.length ===
          0
      ) {

        return "";
      }


      return `

        <section class="category-results">

          <div class="category-results-title">
            カテゴリ別正答率
          </div>


          <div class="category-results-list">

            ${entries
              .map(
                function (
                  entry
                ) {

                  const category =
                    entry[0];

                  const stats =
                    entry[1];


                  const accuracy =
                    Math.round(
                      (
                        stats.correct /
                        stats.total
                      ) *
                      100
                    );


                  return `

                    <div class="category-result-row">

                      <div class="category-result-top">

                        <span class="category-result-name">
                          ${escapeHtml(
                            category
                          )}
                        </span>

                        <span class="category-result-score">

                          ${stats.correct}
                          /
                          ${stats.total}

                          <strong class="category-result-accuracy">
                            ${accuracy}%
                          </strong>

                        </span>

                      </div>


                      <div class="category-result-bar-wrap">

                        <div
                          class="category-result-bar"
                          style="width:${accuracy}%;"
                        ></div>

                      </div>

                    </div>

                  `;
                }
              )
              .join("")}

          </div>

        </section>

      `;
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


    /* =========================
       HTMLエスケープ
    ========================= */

    function escapeHtml(
      value
    ) {

      return String(value)

        .replaceAll(
          "&",
          "&amp;"
        )

        .replaceAll(
          "<",
          "&lt;"
        )

        .replaceAll(
          ">",
          "&gt;"
        )

        .replaceAll(
          '"',
          "&quot;"
        )

        .replaceAll(
          "'",
          "&#039;"
        );
    }
  }
);


/* =========================================================
   Supabase
========================================================= */


/* =========================
   匿名ログイン
========================= */

async function ensureAnonymousUser() {

  try {

    const {
      data: {
        user
      },
      error:
        userError
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


    if (
      error
    ) {

      console.error(
        "匿名ログインエラー:",
        error
      );

      return null;
    }


    return data.user;


  } catch (error) {

    console.error(
      "匿名ログイン処理エラー:",
      error
    );

    return null;
  }
}


/* =========================
   挑戦開始
========================= */

async function createQuizSession(
  mode,
  questionCount,
  answeredCount = 0,
  score = 0
) {

  try {

    const user =
      await ensureAnonymousUser();


    if (
      !user
    ) {

      console.error(
        "quiz_sessions作成失敗：ユーザーが取得できません"
      );

      return null;
    }


    const now =
      new Date().toISOString();


    const {
      data,
      error
    } =

      await supabaseClient
        .from(
          "quiz_sessions"
        )
        .insert(
          {

            user_id:
              user.id,

            mode:
              mode,

            question_count:
              questionCount,

            question_set_version:
              QUESTION_SET_VERSION,

            answered_count:
              answeredCount,

            score:
              score,

            last_activity_at:
              now
          }
        )
        .select(
          "id"
        )
        .single();


    if (
      error
    ) {

      console.error(
        "quiz_sessions 作成エラー:",
        error
      );

      return null;
    }


    return data
      ? data.id
      : null;


  } catch (error) {

    console.error(
      "quiz_sessions 作成処理エラー:",
      error
    );

    return null;
  }
}


/* =========================
   1問ごとの回答保存
========================= */

async function recordQuizAnswer(
  sessionId,
  questionId,
  questionNumber,
  category,
  selectedAnswer,
  isCorrect
) {

  try {

    if (
      !sessionId
    ) {

      return false;
    }


    const user =
      await ensureAnonymousUser();


    if (
      !user
    ) {

      return false;
    }


    const {
      error
    } =

      await supabaseClient
        .from(
          "quiz_answers"
        )
        .insert(
          {

            session_id:
              sessionId,

            user_id:
              user.id,

            question_id:
              questionId,

            question_number:
              questionNumber,

            category:
              category,

            selected_answer:
              selectedAnswer,

            is_correct:
              isCorrect
          }
        );


    if (
      error
    ) {

      console.error(
        "quiz_answers 保存エラー:",
        error
      );

      return false;
    }


    return true;


  } catch (error) {

    console.error(
      "quiz_answers 保存処理エラー:",
      error
    );

    return false;
  }
}


/* =========================
   セッション進捗更新
========================= */

async function updateQuizSessionProgress(
  sessionId,
  answeredCount,
  score
) {

  try {

    if (
      !sessionId
    ) {

      return false;
    }


    const {
      error
    } =

      await supabaseClient
        .from(
          "quiz_sessions"
        )
        .update(
          {

            answered_count:
              answeredCount,

            score:
              score,

            last_activity_at:
              new Date().toISOString()
          }
        )
        .eq(
          "id",
          sessionId
        );


    if (
      error
    ) {

      console.error(
        "quiz_sessions 更新エラー:",
        error
      );

      return false;
    }


    return true;


  } catch (error) {

    console.error(
      "quiz_sessions 更新処理エラー:",
      error
    );

    return false;
  }
}


/* =========================
   完走記録
========================= */

async function completeQuizSession(
  sessionId,
  answeredCount,
  score
) {

  try {

    if (
      !sessionId
    ) {

      return false;
    }


    const now =
      new Date().toISOString();


    const {
      error
    } =

      await supabaseClient
        .from(
          "quiz_sessions"
        )
        .update(
          {

            answered_count:
              answeredCount,

            score:
              score,

            completed_at:
              now,

            last_activity_at:
              now
          }
        )
        .eq(
          "id",
          sessionId
        );


    if (
      error
    ) {

      console.error(
        "完走記録エラー:",
        error
      );

      return false;
    }


    return true;


  } catch (error) {

    console.error(
      "完走記録処理エラー:",
      error
    );

    return false;
  }
}


/* =========================
   挑戦破棄
========================= */

async function abandonQuizSession(
  sessionId
) {

  try {

    if (
      !sessionId
    ) {

      return false;
    }


    const now =
      new Date().toISOString();


    const {
      error
    } =

      await supabaseClient
        .from(
          "quiz_sessions"
        )
        .update(
          {

            abandoned_at:
              now,

            last_activity_at:
              now
          }
        )
        .eq(
          "id",
          sessionId
        )
        .is(
          "completed_at",
          null
        );


    if (
      error
    ) {

      console.error(
        "破棄記録エラー:",
        error
      );

      return false;
    }


    return true;


  } catch (error) {

    console.error(
      "破棄記録処理エラー:",
      error
    );

    return false;
  }
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


    if (
      !user
    ) {

      return null;
    }


    const {
      error:
        insertError
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
      insertError.code !==
        "23505"
    ) {

      console.error(
        "初回回答保存エラー:",
        insertError
      );

      return null;
    }


    const {
      data:
        statsData,
      error:
        statsError
    } =

      await supabaseClient
        .rpc(
          "get_question_stats",
          {

            p_question_id:
              questionId
          }
        );


    if (
      statsError
    ) {

      console.error(
        "正答率取得エラー:",
        statsError
      );

      return null;
    }


    if (
      !statsData ||
      statsData.length ===
        0
    ) {

      return null;
    }


    return statsData[0];


  } catch (error) {

    console.error(
      "初回回答処理エラー:",
      error
    );

    return null;
  }
}


/* =========================
   物申す
========================= */

async function submitQuestionReport(
  questionId,
  reportType,
  message
) {

  try {

    const user =
      await ensureAnonymousUser();


    if (
      !user
    ) {

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


    if (
      error
    ) {

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
