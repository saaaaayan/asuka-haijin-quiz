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

    let reviewAnswers =
      [];

    let retryOriginResultArgs =
      null;


    /* =========================
       裏白蛇 危険階層
    ========================= */

    const URAHAKU_DANGER_FLOOR_RANGES = [
      [51, 52],
      [61, 65],
      [71, 75],
      [82, 86],
      [94, 99]
    ];


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

    const embeddedFloorTestValue =
      window.__ASUKA_FLOOR_TEST__;

    const floorTestValue =
      embeddedFloorTestValue !==
        undefined &&
      embeddedFloorTestValue !==
        null

        ? String(
            embeddedFloorTestValue
          )

        : urlParams.get(
            "floortest"
          );

    const isFloorTestMode =
      floorTestValue !==
        null;


    function shouldTrackAnalytics() {

      return (
        !isTestMode &&
        !isResultTestMode &&
        !isDataTestMode &&
        !isLastResultTestMode &&
        !isFloorTestMode
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


    window.runAsukaFloorTest =
      function (
        floor
      ) {

        runFloorTest(
          floor
        );
      };


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


    if (isFloorTestMode) {

      runFloorTest();

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

            <span class="previous-result-labels">

              <span class="previous-result-kicker">
                LAST RESULT
              </span>

              <span class="previous-result-kicker-ja">
                前回の結果
              </span>

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

          reviewAnswers:
            reviewAnswers,

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

          reviewData:
            Array.isArray(
              saved.reviewAnswers
            )
              ? saved.reviewAnswers
              : [],

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
       裏白蛇フロア構成
    ========================= */

    function isUrahakuDangerFloor(
      floor
    ) {

      return URAHAKU_DANGER_FLOOR_RANGES.some(
        function (
          range
        ) {

          return (
            floor >=
              range[0] &&
            floor <=
              range[1]
          );
        }
      );
    }



    function getQuizStageMeta(
      questionIndex,
      totalQuestions,
      mode
    ) {

      if (
        mode ===
          "main" &&
        totalQuestions ===
          100
      ) {

        if (
          questionIndex ===
            99
        ) {

          return {
            kind:
              "bonus",

            primary:
              "BONUS STAGE",

            secondary:
              "第100問 / 全100問",

            isDanger:
              false
          };
        }


        const floor =
          questionIndex + 1;


        return {
          kind:
            "floor",

          floor:
            floor,

          primary:
            `${floor}F`,

          secondary:
            `第${questionIndex + 1}問 / 全100問`,

          isDanger:
            isUrahakuDangerFloor(
              floor
            )
        };
      }


      return {
        kind:
          "question",

        primary:
          `第${questionIndex + 1}問 / 全${totalQuestions}問`,

        secondary:
          "",

        isDanger:
          false
      };
    }



    function getReviewStageLabel(
      questionNumber,
      totalQuestions
    ) {

      if (
        totalQuestions ===
          100
      ) {

        if (
          questionNumber ===
            100
        ) {

          return "BONUS";
        }


        if (
          questionNumber >=
            1 &&
          questionNumber <=
            99
        ) {

          return `${questionNumber}F`;
        }
      }


      return `第${questionNumber}問`;
    }



    function getEffectiveQuestionDifficulty(
      question
    ) {

      const configured =
        Number(
          question?.difficulty
        );

      const answerCount =
        Number(
          question?.difficulty_answer_count
        );

      const measured =
        Number(
          question?.measured_difficulty
        );


      if (
        Number.isFinite(
          answerCount
        ) &&
        answerCount >
          20 &&
        Number.isInteger(
          measured
        ) &&
        measured >=
          1 &&
        measured <=
          5
      ) {

        return measured;
      }


      if (
        Number.isInteger(
          configured
        ) &&
        configured >=
          1 &&
        configured <=
          5
      ) {

        return configured;
      }


      return 3;
    }



    function arrangeQuestionsForUrahaku(
      questions
    ) {

      if (
        !Array.isArray(
          questions
        ) ||
        questions.length !==
          100
      ) {

        return questions;
      }


      /*
        有効難易度で並べ替える。
        回答数20以下は設定難易度、
        21回答以上は実測難易度を優先する。
      */


      const shuffled =
        shuffleArray(
          [...questions]
        );


      const sortedByDifficulty =
        [...shuffled].sort(
          function (
            a,
            b
          ) {

            return (
              getEffectiveQuestionDifficulty(
                b
              ) -
              getEffectiveQuestionDifficulty(
                a
              )
            );
          }
        );


      const dangerIndexes =
        [];

      const normalIndexes =
        [];


      for (
        let index =
          0;
        index <
          100;
        index++
      ) {

        const questionNumber =
          index + 1;


        if (
          questionNumber <=
            99 &&
          isUrahakuDangerFloor(
            questionNumber
          )
        ) {

          dangerIndexes.push(
            index
          );


        } else {

          normalIndexes.push(
            index
          );
        }
      }


      const arranged =
        new Array(
          100
        );

      const hardQuestions =
        sortedByDifficulty.slice(
          0,
          dangerIndexes.length
        );

      const otherQuestions =
        sortedByDifficulty.slice(
          dangerIndexes.length
        );


      shuffleArray(
        dangerIndexes
      ).forEach(
        function (
          index,
          position
        ) {

          arranged[
            index
          ] =
            hardQuestions[
              position
            ];
        }
      );


      shuffleArray(
        normalIndexes
      ).forEach(
        function (
          index,
          position
        ) {

          arranged[
            index
          ] =
            otherQuestions[
              position
            ];
        }
      );


      return arranged;
    }



    async function runFloorTest(
      requestedPosition = null
    ) {

      try {

        const requestedFloor =
          Number(
            requestedPosition !==
              null

              ? requestedPosition

              : floorTestValue
          );

        const position =
          Number.isInteger(
            requestedFloor
          ) &&
          requestedFloor >=
            1 &&
          requestedFloor <=
            100

            ? requestedFloor

            : 61;


        const allQuestions =
          await loadQuestionsData();


        quizQuestions =
          shuffleArray(
            [...allQuestions]
          ).slice(
            0,
            Math.min(
              100,
              allQuestions.length
            )
          );


        if (
          quizQuestions.length <
            100
        ) {

          throw new Error(
            "フロア表示テストには公開問題が100問以上必要です。"
          );
        }


        quizMode =
          "main";

        currentQuestionIndex =
          position - 1;

        score =
          0;

        categoryStats =
          {};

        categoryStatsComplete =
          true;

        reviewAnswers =
          [];

        answerLocked =
          false;

        quizSessionId =
          null;


        showQuestion();


      } catch (
        error
      ) {

        showQuestionDataError(
          error
        );
      }
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


        if (
          quizMode ===
            "main" &&
          quizQuestions.length ===
            100
        ) {

          quizQuestions =
            arrangeQuestionsForUrahaku(
              quizQuestions
            );
        }


        currentQuestionIndex =
          0;

        score =
          0;

        categoryStats =
          {};

        categoryStatsComplete =
          true;

        reviewAnswers =
          [];

        retryOriginResultArgs =
          null;

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
       表示直前の公開状態確認
    ========================= */

    async function loadPublishedQuestionById(
      questionId
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
            "id,category,type,instruction,question,choices,answer,explanation,tags,difficulty,difficulty_answer_count,measured_difficulty"
          )
          .eq(
            "id",
            questionId
          )
          .eq(
            "is_published",
            true
          )
          .limit(
            1
          );


      if (
        error
      ) {

        console.error(
          "公開状態確認エラー:",
          error
        );


        throw new Error(
          "問題の公開状態を確認できませんでした。"
        );
      }


      if (
        !Array.isArray(
          data
        ) ||
        data.length ===
          0
      ) {

        return null;
      }


      const question = {
        ...data[0],

        instruction:
          data[0].instruction ??
          "",

        explanation:
          data[0].explanation ??
          "",

        tags:
          Array.isArray(
            data[0].tags
          )
            ? data[0].tags
            : []
      };


      validateQuestionsData(
        [
          question
        ]
      );


      return question;
    }



    async function resolveQuestionForDisplay() {

      const plannedQuestion =
        quizQuestions[
          currentQuestionIndex
        ];


      if (
        !plannedQuestion ||
        plannedQuestion.id ===
          undefined ||
        plannedQuestion.id ===
          null
      ) {

        throw new Error(
          "表示予定の問題データが見つかりません。"
        );
      }


      const publishedQuestion =
        await loadPublishedQuestionById(
          plannedQuestion.id
        );


      if (
        publishedQuestion
      ) {

        quizQuestions[
          currentQuestionIndex
        ] =
          publishedQuestion;


        return publishedQuestion;
      }


      if (
        quizMode ===
          "retry"
      ) {

        quizQuestions.splice(
          currentQuestionIndex,
          1
        );


        if (
          currentQuestionIndex >=
            quizQuestions.length
        ) {

          return null;
        }


        return resolveQuestionForDisplay();
      }


      /*
        予定されていた問題が非公開・削除済みなら、
        現在公開中の別問題へ差し替える。
      */
      const allPublishedQuestions =
        await loadQuestionsData();


      const plannedIds =
        new Set(
          quizQuestions
            .map(
              function (
                question
              ) {

                return (
                  question &&
                  question.id !==
                    undefined &&
                  question.id !==
                    null
                )
                  ? String(
                      question.id
                    )
                  : null;
              }
            )
            .filter(
              Boolean
            )
        );


      let candidates =
        allPublishedQuestions.filter(
          function (
            question
          ) {

            return !plannedIds.has(
              String(
                question.id
              )
            );
          }
        );


      /*
        通常は未使用問題から補充する。
        公開問題数が極端に減って未使用候補がない場合は、
        挑戦を止めないことを優先して未回答の公開問題から救済する。
      */
      if (
        candidates.length ===
          0
      ) {

        const answeredIds =
          new Set(
            quizQuestions
              .slice(
                0,
                currentQuestionIndex
              )
              .map(
                function (
                  question
                ) {

                  return (
                    question &&
                    question.id !==
                      undefined &&
                    question.id !==
                      null
                  )
                    ? String(
                        question.id
                      )
                    : null;
                }
              )
              .filter(
                Boolean
              )
          );


        candidates =
          allPublishedQuestions.filter(
            function (
              question
            ) {

              return (
                String(
                  question.id
                ) !==
                  String(
                    plannedQuestion.id
                  ) &&
                !answeredIds.has(
                  String(
                    question.id
                  )
                )
              );
            }
          );
      }


      if (
        candidates.length ===
          0
      ) {

        candidates =
          allPublishedQuestions.filter(
            function (
              question
            ) {

              return (
                String(
                  question.id
                ) !==
                String(
                  plannedQuestion.id
                )
              );
            }
          );
      }


      if (
        candidates.length ===
          0
      ) {

        throw new Error(
          "差し替え可能な公開問題がありません。"
        );
      }


      const targetDifficulty =
        getEffectiveQuestionDifficulty(
          plannedQuestion
        );


      const closestDifference =
        Math.min(
          ...candidates.map(
            function (
              question
            ) {

              return Math.abs(
                getEffectiveQuestionDifficulty(
                  question
                ) -
                targetDifficulty
              );
            }
          )
        );


      const closestCandidates =
        candidates.filter(
          function (
            question
          ) {

            return (
              Math.abs(
                getEffectiveQuestionDifficulty(
                  question
                ) -
                targetDifficulty
              ) ===
              closestDifference
            );
          }
        );


      const replacement =
        closestCandidates[
          Math.floor(
            Math.random() *
            closestCandidates.length
          )
        ];


      console.info(
        `問題ID #${plannedQuestion.id} は現在非公開のため、問題ID #${replacement.id} に差し替えました。`
      );


      quizQuestions[
        currentQuestionIndex
      ] =
        replacement;


      return replacement;
    }



    /* =========================
       問題表示
    ========================= */

    async function showQuestion() {

      answerLocked =
        false;


      let question;


      try {

        question =
          await resolveQuestionForDisplay();


      } catch (
        error
      ) {

        console.error(
          "問題表示前確認エラー:",
          error
        );


        showQuestionDataError(
          error
        );

        return;
      }


      if (
        quizMode ===
          "main"
      ) {

        /*
          差し替え後の問題IDを保存してから表示する。
        */
        saveProgress(
          currentQuestionIndex
        );
      }


      if (!question) {

        if (
          quizMode ===
            "retry"
        ) {

          showRetryResult();

          return;
        }


        showQuestionDataError(
          new Error(
            "表示する問題データが見つかりません。"
          )
        );

        return;
      }


      const stageMeta =
        getQuizStageMeta(
          currentQuestionIndex,
          quizQuestions.length,
          quizMode
        );


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

          <div
            class="
              question-stage
              question-stage-${stageMeta.kind}
              ${
                stageMeta.isDanger
                  ? "question-stage-danger"
                  : ""
              }
            "
          >

            <span class="question-stage-primary">
              ${stageMeta.primary}
            </span>

            ${
              stageMeta.isDanger

                ? `
                  <span class="danger-floor-badge">
                    DANGER FLOOR
                  </span>
                `

                : ""
            }

            ${
              stageMeta.secondary

                ? `
                  <span class="question-stage-secondary">
                    ${stageMeta.secondary}
                  </span>
                `

                : ""
            }

          </div>


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
        quizMode ===
          "main" ||
        quizMode ===
          "retry"
      ) {

        const reviewEntry = {

          questionNumber:
            currentQuestionIndex + 1,

          questionId:
            question.id,

          category:
            question.category,

          type:
            question.type,

          instruction:
            question.instruction || "",

          question:
            question.question || "",

          choices:
            Array.isArray(
              question.choices
            )
              ? [...question.choices]
              : [],

          correctAnswer:
            Array.isArray(
              question.answer
            )
              ? [...question.answer]
              : question.answer,

          explanation:
            question.explanation || "",

          selectedAnswer:
            Array.isArray(
              selectedAnswer
            )
              ? [...selectedAnswer]
              : selectedAnswer,

          isCorrect:
            isCorrect
        };


        const existingReviewIndex =
          reviewAnswers.findIndex(
            function (
              item
            ) {

              return (
                item &&
                item.questionNumber ===
                  reviewEntry.questionNumber
              );
            }
          );


        if (
          existingReviewIndex >=
            0
        ) {

          reviewAnswers[
            existingReviewIndex
          ] =
            reviewEntry;


        } else {

          reviewAnswers.push(
            reviewEntry
          );
        }
      }


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
        quizMode ===
          "retry"

          ? Promise.resolve(
              null
            )

          : saveFirstAnswer(
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


          ${
            quizMode ===
              "retry"

              ? ""

              : `
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
              `
          }


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
              "id,category,type,instruction,question,choices,answer,explanation,tags,difficulty,difficulty_answer_count,measured_difficulty"
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

    async function showResultTest() {

      const requestedScore =
        Number(
          urlParams.get(
            "score"
          )
        );


      const testScore =
        Number.isFinite(
          requestedScore
        ) &&
        requestedScore >=
          0 &&
        requestedScore <=
          100

          ? Math.round(
              requestedScore
            )

          : 69;


      const showCompletion =
        urlParams.get(
          "completion"
        ) ===
          "1";


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


      let testReviewData =
        [];


      try {

        const questions =
          (
            await loadQuestionsData()
          ).slice(
            0,
            100
          );


        testReviewData =
          questions.map(
            function (
              question,
              index
            ) {

              const correctAnswers =
                Array.isArray(
                  question.answer
                )
                  ? [...question.answer]
                  : [
                      question.answer
                    ];

              let selectedAnswer;


              if (
                index <
                  testScore
              ) {

                selectedAnswer =
                  Array.isArray(
                    question.answer
                  )
                    ? [...question.answer]
                    : question.answer;


              } else {

                const wrongIndex =
                  question.choices.findIndex(
                    function (
                      choice,
                      choiceIndex
                    ) {

                      return !correctAnswers.includes(
                        choiceIndex
                      );
                    }
                  );


                if (
                  wrongIndex >=
                    0
                ) {

                  selectedAnswer =
                    question.type ===
                      "multiple"
                      ? [
                          wrongIndex
                        ]
                      : wrongIndex;


                } else {

                  selectedAnswer =
                    question.type ===
                      "multiple"
                      ? [
                          correctAnswers[0]
                        ]
                      : (
                          (
                            correctAnswers[0] +
                            1
                          ) %
                          question.choices.length
                        );
                }
              }


              return {

                questionNumber:
                  index + 1,

                questionId:
                  question.id,

                category:
                  question.category,

                type:
                  question.type,

                instruction:
                  question.instruction || "",

                question:
                  question.question || "",

                choices:
                  Array.isArray(
                    question.choices
                  )
                    ? [...question.choices]
                    : [],

                correctAnswer:
                  Array.isArray(
                    question.answer
                  )
                    ? [...question.answer]
                    : question.answer,

                explanation:
                  question.explanation || "",

                selectedAnswer:
                  selectedAnswer,

                isCorrect:
                  index <
                    testScore
              };
            }
          );


      } catch (
        error
      ) {

        console.warn(
          "振り返りテストデータの作成に失敗しました:",
          error
        );
      }


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

          reviewData:
            testReviewData,

          resultTest:
            true,

          showCompletion:
            showCompletion
        }
      );
    }



    /* =========================
       結果
    ========================= */

    function showResult() {

      if (
        quizMode ===
          "retry"
      ) {

        showRetryResult();

        return;
      }


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

          reviewData:
            reviewAnswers,

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
        reviewData = [],
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

      const normalizedReviewData =
        Array.isArray(
          reviewData
        )
          ? reviewData
              .filter(
                function (
                  item
                ) {

                  return (
                    item &&
                    typeof item.questionNumber ===
                      "number"
                  );
                }
              )
              .sort(
                function (
                  a,
                  b
                ) {

                  return (
                    a.questionNumber -
                    b.questionNumber
                  );
                }
              )
          : [];

      const canReviewResult =
        totalValue === 100 &&
        normalizedReviewData.length >
          0;

      const reviewCorrectCount =
        normalizedReviewData.filter(
          function (
            item
          ) {

            return !!item.isCorrect;
          }
        ).length;

      const reviewIncorrectCount =
        normalizedReviewData.length -
        reviewCorrectCount;


      quizCard.innerHTML = `

        <div class="result-screen">

          <p class="hero-label">
            ${
              resultTest
                ? "RESULT TEST / BUILD 1655"
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
            canReviewResult

              ? `

                <button
                  class="
                    next-button
                    result-review-button
                  "
                  type="button"
                >
                  全100問を振り返る
                </button>

                <div class="result-review-summary">
                  正解 ${reviewCorrectCount}問 /
                  不正解 ${reviewIncorrectCount}問
                </div>

              `

              : ""
          }


          ${
            reviewIncorrectCount >
              0

              ? `

                <button
                  class="
                    next-button
                    result-retry-button
                  "
                  type="button"
                >
                  間違えた${reviewIncorrectCount}問に再挑戦する
                </button>

              `

              : ""
          }


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


      const reviewButton =
        document.querySelector(
          ".result-review-button"
        );


      if (
        reviewButton
      ) {

        reviewButton.addEventListener(
          "click",
          function () {

            renderReviewScreen(
              {
                reviewData:
                  normalizedReviewData,

                resultScreenArgs: {
                  scoreValue,
                  totalValue,
                  rankResult,
                  statsSource,
                  statsComplete,
                  reviewData:
                    normalizedReviewData,
                  resultTest,
                  showCompletion
                }
              }
            );
          }
        );
      }


      const retryButton =
        document.querySelector(
          ".result-retry-button"
        );


      if (
        retryButton
      ) {

        retryButton.addEventListener(
          "click",
          function () {

            startRetryQuiz(
              normalizedReviewData,
              {
                scoreValue,
                totalValue,
                rankResult,
                statsSource,
                statsComplete,
                reviewData:
                  normalizedReviewData,
                resultTest,
                showCompletion
              }
            );
          }
        );
      }


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
       間違えた問題だけ再挑戦
    ========================= */

    async function startRetryQuiz(
      sourceReviewData,
      originResultArgs =
        null
    ) {

      if (
        originResultArgs
      ) {

        retryOriginResultArgs =
          originResultArgs;
      }

      const incorrectRows =
        Array.isArray(
          sourceReviewData
        )
          ? sourceReviewData.filter(
              function (item) {
                return item && !item.isCorrect;
              }
            )
          : [];


      if (
        incorrectRows.length === 0
      ) {
        alert("再挑戦する不正解問題はありません。");
        return;
      }


      try {

        const publishedQuestions =
          await loadQuestionsData();

        const publishedMap =
          new Map(
            publishedQuestions.map(
              function (question) {
                return [String(question.id), question];
              }
            )
          );

        const usedIds =
          new Set();

        const retryQuestions =
          incorrectRows
            .map(
              function (item) {
                return publishedMap.get(String(item.questionId));
              }
            )
            .filter(
              function (question) {
                if (!question) {
                  return false;
                }

                const id =
                  String(question.id);

                if (usedIds.has(id)) {
                  return false;
                }

                usedIds.add(id);
                return true;
              }
            );

        const skippedCount =
          incorrectRows.length - retryQuestions.length;


        if (
          retryQuestions.length === 0
        ) {
          alert("間違えた問題は現在すべて非公開になっているため、再挑戦できません。");
          return;
        }


        if (
          skippedCount > 0
        ) {
          alert(String(skippedCount) + "問は現在非公開のため、再挑戦の対象から外しました。");
        }


        quizQuestions =
          retryQuestions;

        currentQuestionIndex =
          0;

        score =
          0;

        categoryStats =
          {};

        categoryStatsComplete =
          true;

        reviewAnswers =
          [];

        answerLocked =
          false;

        quizSessionId =
          null;

        quizMode =
          "retry";

        showQuestion();


      } catch (error) {

        console.error(
          "再挑戦開始エラー:",
          error
        );

        showQuestionDataError(
          error
        );
      }
    }



    function showRetryResult() {

      const total =
        reviewAnswers.length;

      const correctCount =
        reviewAnswers.filter(
          function (item) {
            return !!item.isCorrect;
          }
        ).length;

      const incorrectCount =
        total - correctCount;

      let retryAgainHtml =
        "";

      if (
        incorrectCount > 0
      ) {
        retryAgainHtml =
          '<button class="next-button retry-again-button" type="button">間違えた' +
          String(incorrectCount) +
          '問に再挑戦する</button>';
      } else {
        retryAgainHtml =
          '<div class="retry-perfect-message">間違えた問題をすべて正解できました。</div>';
      }

      quizCard.innerHTML =
        '<div class="result-screen retry-result-screen">' +
        '<p class="hero-label">REVIEW RESULT</p>' +
        '<div class="result-brand">' +
        '<div class="result-brand-title">' +
        '<span class="title-asuka">アスカ見参</span>' +
        '<span class="title-haijin">廃人検定</span>' +
        '</div>' +
        '<h1 class="result-heading">復習結果</h1>' +
        '</div>' +
        '<div class="final-score">' +
        String(correctCount) +
        '<span> / ' + String(total) + '</span></div>' +
        '<div class="percentage">' +
        (incorrectCount === 0 ? "全問正解！" : "あと" + String(incorrectCount) + "問") +
        '</div>' +
        retryAgainHtml +
        '<button class="restart-button retry-origin-result-button" type="button">100問版の結果に戻る</button>' +
        '<button class="restart-button retry-top-button" type="button">トップ画面へ戻る</button>' +
        '</div>';

      const retryAgainButton =
        document.querySelector(
          ".retry-again-button"
        );

      if (
        retryAgainButton
      ) {
        retryAgainButton.addEventListener(
          "click",
          function () {
            startRetryQuiz(
              reviewAnswers
            );
          }
        );
      }

      const originResultButton =
        document.querySelector(
          ".retry-origin-result-button"
        );


      if (
        originResultButton
      ) {

        originResultButton.addEventListener(
          "click",
          async function () {

            if (
              retryOriginResultArgs
            ) {

              renderMainResultScreen(
                retryOriginResultArgs
              );


            } else if (
              isResultTestMode
            ) {

              await showResultTest();


            } else {

              const saved =
                loadLastResult();


              if (
                saved
              ) {

                renderMainResultScreen(
                  {
                    scoreValue:
                      saved.score,

                    totalValue:
                      saved.total,

                    rankResult: {
                      rank:
                        saved.rank,

                      title:
                        saved.title,

                      comment:
                        saved.comment || ""
                    },

                    statsSource:
                      saved.categoryStats || {},

                    statsComplete:
                      typeof saved.categoryStatsComplete ===
                        "boolean"
                        ? saved.categoryStatsComplete
                        : true,

                    reviewData:
                      Array.isArray(
                        saved.reviewAnswers
                      )
                        ? saved.reviewAnswers
                        : [],

                    resultTest:
                      false,

                    showCompletion:
                      true
                  }
                );


              } else {

                alert(
                  "元の100問版の結果を読み込めませんでした。"
                );

                return;
              }
            }


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


      const topButton =
        document.querySelector(
          ".retry-top-button"
        );

      if (
        topButton
      ) {
        topButton.addEventListener(
          "click",
          goToTop
        );
      }

      window.scrollTo({
        top: 0,
        behavior: "auto"
      });
    }


    /* =========================
       全問題振り返り
    ========================= */

    function normalizeReviewAnswerIndices(
      value
    ) {

      const values =
        Array.isArray(
          value
        )
          ? value
          : [
              value
            ];


      return values
        .map(
          function (
            item
          ) {

            return Number(
              item
            );
          }
        )
        .filter(
          function (
            item
          ) {

            return Number.isInteger(
              item
            );
          }
        )
        .sort(
          function (
            a,
            b
          ) {

            return a - b;
          }
        );
    }



    function renderReviewScreen(
      {
        reviewData,
        resultScreenArgs
      }
    ) {

      const rows =
        Array.isArray(
          reviewData
        )
          ? [...reviewData]
              .sort(
                function (
                  a,
                  b
                ) {

                  return (
                    a.questionNumber -
                    b.questionNumber
                  );
                }
              )
          : [];


      const correctCount =
        rows.filter(
          function (
            item
          ) {

            return !!item.isCorrect;
          }
        ).length;

      const incorrectRows =
        rows.filter(
          function (
            item
          ) {

            return !item.isCorrect;
          }
        );

      const incorrectCount =
        incorrectRows.length;


      function reviewChoiceHtml(
        item,
        choice,
        choiceIndex
      ) {

        const correctAnswers =
          normalizeReviewAnswerIndices(
            item.correctAnswer
          );

        const selectedAnswers =
          normalizeReviewAnswerIndices(
            item.selectedAnswer
          );

        const isCorrectChoice =
          correctAnswers.includes(
            choiceIndex
          );

        const isSelectedChoice =
          selectedAnswers.includes(
            choiceIndex
          );


        let choiceClass =
          "";

        if (
          isCorrectChoice &&
          isSelectedChoice
        ) {

          choiceClass =
            "review-choice-selected-correct";


        } else if (
          isCorrectChoice
        ) {

          choiceClass =
            "review-choice-correct";


        } else if (
          isSelectedChoice
        ) {

          choiceClass =
            "review-choice-selected-wrong";
        }


        return `

          <div
            class="
              review-choice
              ${choiceClass}
            "
          >

            <span class="review-choice-label">
              ${String.fromCharCode(
                65 + choiceIndex
              )}
            </span>

            <span class="review-choice-text">
              ${escapeHtml(
                choice
              )}
            </span>

            <span class="review-choice-tags">

              ${
                isCorrectChoice

                  ? `
                    <span class="review-choice-tag review-choice-tag-correct">
                      正解
                    </span>
                  `

                  : ""
              }

              ${
                isSelectedChoice

                  ? `
                    <span class="review-choice-tag review-choice-tag-selected">
                      あなたの回答
                    </span>
                  `

                  : ""
              }

            </span>

          </div>

        `;
      }


      quizCard.innerHTML = `

        <div class="review-screen">

          <div class="review-head">

            <div>
              <p class="hero-label">
                ANSWER REVIEW
              </p>

              <h1 class="review-title">
                ${rows.length}問を振り返る
              </h1>

              <p class="review-intro">
                問題を開くと、自分の回答・正解・解説を確認できます。
              </p>
            </div>

            <button
              class="review-back-button"
              type="button"
            >
              結果に戻る
            </button>

          </div>


          <div class="review-score-summary">

            <div class="review-score-card">
              <span>正解</span>
              <strong>
                ${correctCount}
              </strong>
            </div>

            <div class="review-score-card review-score-card-wrong">
              <span>不正解</span>
              <strong>
                ${incorrectCount}
              </strong>
            </div>

            <div class="review-score-card">
              <span>記録済み</span>
              <strong>
                ${rows.length}
              </strong>
            </div>

          </div>


          <div class="review-filters">

            <button
              class="review-filter-button active"
              type="button"
              data-filter="all"
            >
              全て（${rows.length}）
            </button>

            <button
              class="review-filter-button"
              type="button"
              data-filter="incorrect"
            >
              不正解だけ（${incorrectCount}）
            </button>

            <button
              class="review-filter-button"
              type="button"
              data-filter="correct"
            >
              正解だけ（${correctCount}）
            </button>

          </div>


          ${
            incorrectCount >
              0

              ? `

                <button
                  class="
                    next-button
                    review-retry-button
                  "
                  type="button"
                >
                  間違えた${incorrectCount}問に再挑戦する
                </button>

              `

              : ""
          }


          <div class="review-list">

            ${rows
              .map(
                function (
                  item
                ) {

                  const statusClass =
                    item.isCorrect
                      ? "review-item-correct"
                      : "review-item-incorrect";

                  const statusLabel =
                    item.isCorrect
                      ? "○ 正解"
                      : "× 不正解";

                  const filterValue =
                    item.isCorrect
                      ? "correct"
                      : "incorrect";

                  const choices =
                    Array.isArray(
                      item.choices
                    )
                      ? item.choices
                      : [];


                  return `

                    <details
                      class="
                        review-item
                        ${statusClass}
                      "
                      data-review-status="${filterValue}"
                      data-question-id="${escapeHtml(String(item.questionId))}"
                    >

                      <summary class="review-item-summary">

                        <span class="review-item-number">
                          ${escapeHtml(
                            getReviewStageLabel(
                              item.questionNumber,
                              rows.length
                            )
                          )}
                        </span>

                        <span class="review-item-status">
                          ${statusLabel}
                        </span>

                        <span class="review-item-question">
                          ${escapeHtml(
                            item.question || ""
                          )}
                        </span>

                      </summary>


                      <div class="review-item-body">

                        <div class="review-item-meta">

                          <span>
                            問題ID #${escapeHtml(
                              item.questionId
                            )}
                          </span>

                          <span>
                            ${escapeHtml(
                              item.category || "その他"
                            )}
                          </span>

                        </div>


                        ${
                          item.instruction

                            ? `
                              <div class="review-instruction">
                                ${escapeHtml(
                                  item.instruction
                                )}
                              </div>
                            `

                            : ""
                        }


                        <div class="review-choices">

                          ${choices
                            .map(
                              function (
                                choice,
                                choiceIndex
                              ) {

                                return reviewChoiceHtml(
                                  item,
                                  choice,
                                  choiceIndex
                                );
                              }
                            )
                            .join("")}

                        </div>


                        <div class="review-explanation">

                          <div class="review-explanation-title">
                            解説
                          </div>

                          <div class="review-explanation-text">
                            ${escapeHtml(
                              item.explanation || "解説はありません。"
                            )}
                          </div>

                        </div>


                        <div class="report-section review-report-section">

                          <button
                            class="report-toggle-button review-report-toggle-button"
                            type="button"
                          >
                            この問題に物申す
                          </button>


                          <div
                            class="
                              report-form
                              review-report-form
                              hidden
                            "
                          >

                            <div class="report-heading">
                              この問題のどこが気になりますか？
                            </div>


                            <select class="report-type review-report-type">

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
                              class="report-message review-report-message"
                              maxlength="2000"
                              placeholder="具体的な内容を入力してください"
                            ></textarea>


                            <p class="report-note">
                              投稿内容は管理者に送信されます。一般には公開されません。
                            </p>


                            <button
                              class="report-submit-button review-report-submit-button"
                              type="button"
                            >
                              物申す！
                            </button>


                            <div class="report-status review-report-status"></div>

                          </div>

                        </div>

                      </div>

                    </details>

                  `;
                }
              )
              .join("")}

          </div>


          <button
            class="
              restart-button
              review-bottom-back-button
            "
            type="button"
          >
            結果に戻る
          </button>

        </div>

      `;


      const returnToResult =
        function () {

          renderMainResultScreen(
            resultScreenArgs
          );

          window.scrollTo(
            {
              top:
                0,

              behavior:
                "auto"
            }
          );
        };


      document
        .querySelectorAll(
          ".review-back-button, .review-bottom-back-button"
        )
        .forEach(
          function (
            button
          ) {

            button.addEventListener(
              "click",
              returnToResult
            );
          }
        );


      const filterButtons =
        [
          ...document.querySelectorAll(
            ".review-filter-button"
          )
        ];

      const reviewItems =
        [
          ...document.querySelectorAll(
            ".review-item"
          )
        ];


      filterButtons.forEach(
        function (
          button
        ) {

          button.addEventListener(
            "click",
            function () {

              const filter =
                button.dataset.filter;


              filterButtons.forEach(
                function (
                  item
                ) {

                  item.classList.remove(
                    "active"
                  );
                }
              );


              button.classList.add(
                "active"
              );


              reviewItems.forEach(
                function (
                  item
                ) {

                  const visible =
                    filter ===
                      "all" ||
                    item.dataset.reviewStatus ===
                      filter;


                  item.classList.toggle(
                    "hidden",
                    !visible
                  );


                  if (
                    !visible
                  ) {

                    item.open =
                      false;
                  }
                }
              );
            }
          );
        }
      );


      const reviewRetryButton =
        document.querySelector(
          ".review-retry-button"
        );


      if (
        reviewRetryButton
      ) {

        reviewRetryButton.addEventListener(
          "click",
          function () {

            startRetryQuiz(
              incorrectRows,
              resultScreenArgs
            );
          }
        );
      }


      document
        .querySelectorAll(
          ".review-item"
        )
        .forEach(
          function (
            reviewItem
          ) {

            const toggleButton =
              reviewItem.querySelector(
                ".review-report-toggle-button"
              );

            const form =
              reviewItem.querySelector(
                ".review-report-form"
              );

            const submitButton =
              reviewItem.querySelector(
                ".review-report-submit-button"
              );

            const typeSelect =
              reviewItem.querySelector(
                ".review-report-type"
              );

            const messageInput =
              reviewItem.querySelector(
                ".review-report-message"
              );

            const status =
              reviewItem.querySelector(
                ".review-report-status"
              );


            if (
              toggleButton &&
              form
            ) {

              toggleButton.addEventListener(
                "click",
                function () {

                  form.classList.toggle(
                    "hidden"
                  );
                }
              );
            }


            if (
              !submitButton ||
              !typeSelect ||
              !messageInput ||
              !status
            ) {
              return;
            }


            submitButton.addEventListener(
              "click",
              async function () {

                const reportType =
                  typeSelect.value;

                const message =
                  messageInput.value.trim();


                if (
                  !reportType
                ) {
                  status.textContent =
                    "指摘内容を選んでください。";
                  status.className =
                    "report-status review-report-status error";
                  return;
                }


                if (
                  !message
                ) {
                  status.textContent =
                    "具体的な内容を入力してください。";
                  status.className =
                    "report-status review-report-status error";
                  return;
                }


                submitButton.disabled =
                  true;
                submitButton.textContent =
                  "送信中...";


                const success =
                  await submitQuestionReport(
                    reviewItem.dataset.questionId,
                    reportType,
                    message
                  );


                if (
                  success
                ) {
                  status.textContent =
                    "送信しました。ありがとうございます。";
                  status.className =
                    "report-status review-report-status success";
                  submitButton.textContent =
                    "送信済み";
                } else {
                  status.textContent =
                    "送信できませんでした。もう一度お試しください。";
                  status.className =
                    "report-status review-report-status error";
                  submitButton.disabled =
                    false;
                  submitButton.textContent =
                    "物申す！";
                }
              }
            );
          }
        );


      window.scrollTo(
        {
          top:
            0,

          behavior:
            "auto"
        }
      );
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
        isResultTestMode

          ? new URL(
              "./",
              window.location.href
            ).href

          : `${window.location.origin}${window.location.pathname}`;


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


      await ensureShareFontsReady();


      const canvas =
        createResultShareCanvas(
          {
            scoreValue,
            totalValue,
            rankResult,
            statsSource,
            statsComplete,
            shareUrl,
            comment:
              rankResult.comment || ""
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


    async function ensureShareFontsReady() {

      if (
        !document.fonts
      ) {

        return;
      }


      try {

        await Promise.all(
          [
            document.fonts.ready,

            document.fonts.load(
              '400 38px "Yuji Syuku"'
            ),

            document.fonts.load(
              '800 30px "Yuji Syuku"'
            ),

            document.fonts.load(
              '400 32px "Yuji Syuku"'
            ),

            document.fonts.load(
              '400 48px "Reggae One"'
            ),

            document.fonts.load(
              '600 15px "Noto Sans JP"'
            ),

            document.fonts.load(
              '700 18px "Noto Sans JP"'
            ),

            document.fonts.load(
              '900 54px "Noto Sans JP"'
            )
          ]
        );


      } catch (error) {

        console.warn(
          "共有画像用フォントの読み込み待ちに失敗しました:",
          error
        );
      }
    }


    function createResultShareCanvas(
      {
        scoreValue,
        totalValue,
        rankResult,
        statsSource,
        statsComplete,
        shareUrl,
        comment
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


      /* =========================
         タイトル
         本番結果画面と同じフォント構成
      ========================= */

      const brandFont =
        '"Yuji Syuku", "Yu Mincho", "Hiragino Mincho ProN", serif';


      ctx.font =
        `400 38px ${brandFont}`;

      ctx.textAlign =
        "left";


      const asukaTitle =
        "アスカ見参";

      const haijinTitle =
        "廃人検定";


      const asukaWidth =
        ctx.measureText(
          asukaTitle
        ).width;


      const haijinWidth =
        ctx.measureText(
          haijinTitle
        ).width;


      const brandGap =
        18;


      const brandWidth =
        asukaWidth +
        brandGap +
        haijinWidth;


      const brandStartX =
        600 -
        brandWidth /
        2;


      const brandY =
        72;


      ctx.save();

      ctx.fillStyle =
        "#f6fbff";

      ctx.shadowColor =
        "rgba(100,155,230,0.75)";

      ctx.shadowBlur =
        7;

      ctx.shadowOffsetX =
        2;

      ctx.shadowOffsetY =
        3;

      ctx.fillText(
        asukaTitle,
        brandStartX,
        brandY
      );

      ctx.restore();


      const haijinGradient =
        ctx.createLinearGradient(
          0,
          brandY -
            40,
          0,
          brandY +
            10
        );


      haijinGradient.addColorStop(
        0,
        "#ffe6a3"
      );

      haijinGradient.addColorStop(
        0.38,
        "#f0b34c"
      );

      haijinGradient.addColorStop(
        0.70,
        "#d65b2d"
      );

      haijinGradient.addColorStop(
        1,
        "#9c2f22"
      );


      ctx.save();

      ctx.fillStyle =
        haijinGradient;

      ctx.shadowColor =
        "rgba(88,24,18,0.75)";

      ctx.shadowBlur =
        2;

      ctx.shadowOffsetX =
        2;

      ctx.shadowOffsetY =
        3;

      ctx.fillText(
        haijinTitle,
        brandStartX +
          asukaWidth +
          brandGap,
        brandY
      );

      ctx.restore();


      ctx.fillStyle =
        "#f5f5f5";

      ctx.font =
        `800 30px ${brandFont}`;

      ctx.textAlign =
        "center";

      ctx.fillText(
        "検定結果",
        600,
        116
      );


      /* =========================
         左：スコア
      ========================= */

      ctx.fillStyle =
        panel;

      roundRect(
        ctx,
        65,
        145,
        325,
        339,
        28
      );

      ctx.fill();


      ctx.fillStyle =
        muted;

      ctx.font =
        '700 18px "Noto Sans JP", "Yu Gothic", sans-serif';

      ctx.textAlign =
        "center";

      ctx.fillText(
        "SCORE",
        227,
        190
      );


      const scoreText =
        String(
          scoreValue
        );


      const totalText =
        `/ ${totalValue}`;


      const digitCount =
        scoreText.length;


      const scoreFontSize =
        digitCount >=
          3

          ? 80

          : digitCount ===
              2

            ? 108

            : 126;


      const totalFontSize =
        digitCount >=
          3

          ? 24

          : 30;


      const scoreGap =
        digitCount >=
          3

          ? 6

          : 9;


      ctx.textAlign =
        "left";


      ctx.font =
        `900 ${scoreFontSize}px "Noto Sans JP", "Yu Gothic", sans-serif`;


      const scoreWidth =
        ctx.measureText(
          scoreText
        ).width;


      ctx.font =
        `800 ${totalFontSize}px "Noto Sans JP", "Yu Gothic", sans-serif`;


      const totalWidth =
        ctx.measureText(
          totalText
        ).width;


      const combinedWidth =
        scoreWidth +
        scoreGap +
        totalWidth;


      const scoreStartX =
        227 -
        combinedWidth /
        2;


      ctx.fillStyle =
        white;

      ctx.font =
        `900 ${scoreFontSize}px "Noto Sans JP", "Yu Gothic", sans-serif`;

      ctx.fillText(
        scoreText,
        scoreStartX,
        309
      );


      ctx.fillStyle =
        gold;

      ctx.font =
        `800 ${totalFontSize}px "Noto Sans JP", "Yu Gothic", sans-serif`;

      ctx.fillText(
        totalText,
        scoreStartX +
          scoreWidth +
          scoreGap,
        307
      );


      ctx.textAlign =
        "center";


      const percentage =
        Math.round(
          (
            scoreValue /
            totalValue
          ) *
          100
        );


      ctx.fillStyle =
        muted;

      ctx.font =
        '700 17px "Noto Sans JP", "Yu Gothic", sans-serif';

      ctx.fillText(
        `正答率 ${percentage}%`,
        227,
        382
      );


      ctx.strokeStyle =
        "rgba(229,189,85,0.20)";

      ctx.lineWidth =
        1;

      ctx.beginPath();

      ctx.moveTo(
        105,
        408
      );

      ctx.lineTo(
        350,
        408
      );

      ctx.stroke();





      /* =========================
         右：ランク・称号
      ========================= */

      ctx.fillStyle =
        "rgba(229,189,85,0.15)";

      roundRect(
        ctx,
        420,
        145,
        710,
        108,
        24
      );

      ctx.fill();


      const rankAreaLeft =
        430;


      const rankAreaWidth =
        150;


      const rankCenterX =
        rankAreaLeft +
        rankAreaWidth /
        2;


      const titleAreaLeft =
        610;


      const titleAreaWidth =
        430;


      const titleCenterX =
        titleAreaLeft +
        titleAreaWidth /
        2;


      ctx.fillStyle =
        muted;

      ctx.font =
        '600 13px "Noto Sans JP", sans-serif';

      ctx.textAlign =
        "center";

      ctx.fillText(
        "ランク",
        rankCenterX,
        174
      );


      const rankFontSize =
        rankResult.rank.length >=
          3

          ? 42

          : rankResult.rank.length ===
              2

            ? 48

            : 54;


      ctx.fillStyle =
        "#f1d36a";

      ctx.font =
        `900 ${rankFontSize}px "Noto Sans JP", "Yu Gothic", sans-serif`;

      ctx.fillText(
        rankResult.rank,
        rankCenterX,
        223
      );


      ctx.fillStyle =
        muted;

      ctx.font =
        '600 13px "Noto Sans JP", sans-serif';

      ctx.textAlign =
        "center";

      ctx.fillText(
        "称号",
        titleCenterX,
        174
      );


      drawRankTitleText(
        ctx,
        rankResult.title,
        titleCenterX,
        221,
        titleAreaWidth,
        31,
        19,
        "center"
      );


      /* =========================
         右：コメント
      ========================= */

      ctx.fillStyle =
        panel;

      roundRect(
        ctx,
        420,
        269,
        710,
        215,
        24
      );

      ctx.fill();


      const plainComment =
        stripHtmlForShare(
          comment || ""
        );


      if (
        plainComment
      ) {

        ctx.fillStyle =
          white;

        ctx.textAlign =
          "center";

        drawWrappedTextInBox(
          ctx,
          plainComment,
          {
            x:
              420,

            y:
              269,

            width:
              710,

            height:
              215
          },
          {
            startSize:
              21,

            minSize:
              13,

            lineHeightRatio:
              1.34,

            paddingX:
              28,

            paddingY:
              18,

            fontWeight:
              700,

            fontFamily:
              '"Noto Sans JP", "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif',

            color:
              white,

            align:
              "center",

            valign:
              "middle"
          }
        );


      } else {

        ctx.fillStyle =
          white;

        ctx.font =
          '800 28px "Noto Sans JP", "Yu Gothic", sans-serif';

        ctx.textAlign =
          "center";

        ctx.fillText(
          "あなたは何点取れる？",
          775,
          365
        );


        ctx.fillStyle =
          gold;

        ctx.font =
          '700 18px "Noto Sans JP", "Yu Gothic", sans-serif';

        ctx.fillText(
          "挑戦者、求む。",
          775,
          402
        );
      }


      /* =========================
         カテゴリ別正答率
      ========================= */

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
            520;

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
                  '700 15px "Noto Sans JP", "Yu Gothic", sans-serif';

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
                    13,
                  142,
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
                    13,
                  142 *
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
                  '800 17px "Noto Sans JP", "Yu Gothic", sans-serif';

                ctx.textAlign =
                  "right";

                ctx.fillText(
                  `${accuracy}%`,
                  x +
                    187,
                  startY +
                    22
                );
              }
            );
        }
      }


      /* =========================
         フッター
      ========================= */

      ctx.fillStyle =
        muted;

      ctx.font =
        '600 14px "Noto Sans JP", "Yu Gothic", sans-serif';

      ctx.textAlign =
        "left";

      ctx.fillText(
        "#アスカ見参  #廃人検定",
        70,
        590
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


    function stripHtmlForShare(
      value
    ) {

      const temp =
        document.createElement(
          "div"
        );


      temp.innerHTML =
        String(
          value || ""
        )
          .replace(
            /<\s*\/p\s*>/gi,
            "\n"
          )
          .replace(
            /<\s*br\s*\/?\s*>/gi,
            "\n"
          );


      const text =
        (
          temp.textContent ||
          temp.innerText ||
          ""
        )
          .replace(
            /\n\s*\n+/g,
            "\n"
          )
          .trim();


      return text;
    }


    function wrapShareTextByWidth(
      ctx,
      text,
      maxWidth
    ) {

      const paragraphs =
        String(
          text || ""
        )
          .replace(
            /\r/g,
            ""
          )
          .split(
            /\n+/
          )
          .map(
            function (
              paragraph
            ) {

              return paragraph.trim();
            }
          )
          .filter(
            Boolean
          );


      const lines =
        [];


      paragraphs.forEach(
        function (
          paragraph
        ) {

          let current =
            "";


          Array.from(
            paragraph
          ).forEach(
            function (
              char
            ) {

              const candidate =
                current +
                char;


              if (
                current &&
                ctx.measureText(
                  candidate
                ).width >
                  maxWidth
              ) {

                lines.push(
                  current
                );

                current =
                  char;


              } else {

                current =
                  candidate;
              }
            }
          );


          if (
            current
          ) {

            lines.push(
              current
            );
          }
        }
      );


      return lines;
    }


    function drawWrappedTextInBox(
      ctx,
      text,
      box,
      options = {}
    ) {

      const startSize =
        options.startSize ??
        21;


      const minSize =
        options.minSize ??
        13;


      const lineHeightRatio =
        options.lineHeightRatio ??
        1.34;


      const paddingX =
        options.paddingX ??
        28;


      const paddingY =
        options.paddingY ??
        18;


      const fontWeight =
        options.fontWeight ??
        700;


      const fontFamily =
        options.fontFamily ??
        '"Noto Sans JP", "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';


      const color =
        options.color ??
        "#f6f2e8";


      const align =
        options.align ??
        "center";


      const valign =
        options.valign ??
        "middle";


      const innerWidth =
        Math.max(
          1,
          box.width -
            paddingX *
            2
        );


      const innerHeight =
        Math.max(
          1,
          box.height -
            paddingY *
            2
        );


      let fitted =
        null;


      for (
        let size =
          startSize;
        size >=
          minSize;
        size -=
          1
      ) {

        ctx.font =
          `${fontWeight} ${size}px ${fontFamily}`;


        const lines =
          wrapShareTextByWidth(
            ctx,
            text,
            innerWidth
          );


        const lineHeight =
          Math.ceil(
            size *
            lineHeightRatio
          );


        const totalHeight =
          lines.length *
          lineHeight;


        if (
          totalHeight <=
            innerHeight
        ) {

          fitted = {
            size,
            lines,
            lineHeight,
            truncated:
              false
          };

          break;
        }
      }


      if (
        !fitted
      ) {

        const size =
          minSize;


        ctx.font =
          `${fontWeight} ${size}px ${fontFamily}`;


        const lineHeight =
          Math.ceil(
            size *
            lineHeightRatio
          );


        const maxLines =
          Math.max(
            1,
            Math.floor(
              innerHeight /
              lineHeight
            )
          );


        let lines =
          wrapShareTextByWidth(
            ctx,
            text,
            innerWidth
          );


        const truncated =
          lines.length >
          maxLines;


        if (
          truncated
        ) {

          lines =
            lines.slice(
              0,
              maxLines
            );


          const lastIndex =
            lines.length -
            1;


          let lastLine =
            lines[
              lastIndex
            ]
              .replace(
                /[。！？!?、,\s]+$/g,
                ""
              );


          while (
            lastLine &&
            ctx.measureText(
              lastLine +
              "…"
            ).width >
              innerWidth
          ) {

            lastLine =
              lastLine.slice(
                0,
                -1
              );
          }


          lines[
            lastIndex
          ] =
            lastLine +
            "…";
        }


        fitted = {
          size,
          lines,
          lineHeight,
          truncated
        };
      }


      ctx.save();


      ctx.font =
        `${fontWeight} ${fitted.size}px ${fontFamily}`;

      ctx.fillStyle =
        color;

      ctx.textAlign =
        align;

      ctx.textBaseline =
        "alphabetic";


      const contentHeight =
        fitted.lines.length *
        fitted.lineHeight;


      let firstBaseline =
        box.y +
        paddingY +
        fitted.size;


      if (
        valign ===
          "middle"
      ) {

        firstBaseline =
          box.y +
          (
            box.height -
            contentHeight
          ) /
          2 +
          fitted.size *
          0.86;
      }


      const drawX =
        align ===
          "left"

          ? box.x +
            paddingX

          : align ===
              "right"

            ? box.x +
              box.width -
              paddingX

            : box.x +
              box.width /
              2;


      fitted.lines.forEach(
        function (
          line,
          index
        ) {

          ctx.fillText(
            line,
            drawX,
            firstBaseline +
              index *
              fitted.lineHeight
          );
        }
      );


      ctx.restore();


      return fitted;
    }


    function drawRankTitleText(
      ctx,
      text,
      x,
      y,
      maxWidth,
      startSize,
      minSize,
      align = "left"
    ) {

      let size =
        startSize;


      const applyFont =
        function () {

          ctx.font =
            `400 ${size}px "Reggae One", "Noto Sans JP", sans-serif`;


          if (
            "letterSpacing" in
              ctx
          ) {

            ctx.letterSpacing =
              `${size * 0.035}px`;
          }
        };


      applyFont();


      while (
        size >
          minSize &&
        ctx.measureText(
          text
        ).width >
          maxWidth
      ) {

        size -=
          1;

        applyFont();
      }


      ctx.save();

      applyFont();

      ctx.textAlign =
        align;

      ctx.lineJoin =
        "round";

      ctx.miterLimit =
        2;


      /* 本番CSS:
         color #fff0b5
         1px stroke
         0 2px 0 #6b3608
         0 4px 0 rgba(55,22,0,.72)
         0 6px 18px rgba(212,151,40,.32)
      */

      ctx.strokeStyle =
        "rgba(120,69,10,0.75)";

      ctx.lineWidth =
        Math.max(
          1.4,
          size /
            30
        );

      ctx.strokeText(
        text,
        x,
        y
      );


      ctx.fillStyle =
        "#6b3608";

      ctx.fillText(
        text,
        x,
        y +
          2
      );


      ctx.fillStyle =
        "rgba(55,22,0,0.72)";

      ctx.fillText(
        text,
        x,
        y +
          4
      );


      ctx.shadowColor =
        "rgba(212,151,40,0.32)";

      ctx.shadowBlur =
        18;

      ctx.shadowOffsetX =
        0;

      ctx.shadowOffsetY =
        6;

      ctx.fillStyle =
        "#fff0b5";

      ctx.fillText(
        text,
        x,
        y
      );


      ctx.restore();
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


          <button
            class="
              trial-result-button
              trial-top-button
            "
            type="button"
          >
            トップ画面へ戻る
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


      document
        .querySelector(
          ".trial-top-button"
        )
        .addEventListener(
          "click",
          goToTop
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
        isLastResultTestMode ||
        isFloorTestMode
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

          reviewAnswers:
            reviewAnswers,

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

              return (
                questionMap.get(
                  String(id)
                ) ||
                {
                  /*
                    非公開・削除済みでも挑戦は失効させない。
                    実際にこの順番へ到達したとき、
                    表示直前に公開問題へ差し替える。
                  */
                  id:
                    id,

                  needsReplacement:
                    true
                }
              );
            }
          );


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

        reviewAnswers =
          Array.isArray(
            saved.reviewAnswers
          )
            ? saved.reviewAnswers
            : [];

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


                  const accuracyClass =
                    accuracy >=
                      80

                      ? "high"

                      : accuracy >=
                          50

                        ? "middle"

                        : "low";


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

                          <strong
                            class="
                              category-result-accuracy
                              ${accuracyClass}
                            "
                          >
                            ${accuracy}%
                          </strong>

                        </span>

                      </div>


                      <div class="category-result-bar-wrap">

                        <div
                          class="
                            category-result-bar
                            ${accuracyClass}
                          "
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
