const SUPABASE_URL =
  "https://eiseszhremqmeodxbcuc.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_1mtFdVK6HheU4pVZ7D2wxg_7tb_9PDO";


const QUIZ_SAVE_KEY =
  "asuka-haijin-quiz-progress-v1";

const QUIZ_LAST_RESULT_KEY =
  "asuka-haijin-quiz-last-result-v1";


const STORAGE_SCHEMA_VERSION =
  3;

const QUESTION_SET_VERSION =
  2;

const CATEGORY_STATS_VERSION =
  1;


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


/* =========================================================
   Supabase
========================================================= */

const supabaseClient =

  window.supabase

  &&

  typeof window.supabase
    .createClient ===
    "function"

    ? window.supabase
        .createClient(
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY
        )

    : null;


let anonymousUserPromise =
  null;


/* =========================================================
   Supabase
   匿名ユーザー
========================================================= */

async function ensureAnonymousUser() {

  if (
    !supabaseClient
  ) {

    return null;
  }


  if (
    anonymousUserPromise
  ) {

    return anonymousUserPromise;
  }


  anonymousUserPromise =
    (
      async function () {

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
            !userError

            &&

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

            console.warn(
              "匿名ログインエラー:",
              error
            );


            return null;
          }


          return (
            data?.user ||
            null
          );


        } catch (
          error
        ) {

          console.warn(
            "匿名ログイン処理エラー:",
            error
          );


          return null;
        }
      }
    )();


  const user =
    await anonymousUserPromise;


  if (
    !user
  ) {

    anonymousUserPromise =
      null;
  }


  return user;
}


/* =========================================================
   初回回答保存
   ＋
   みんなの正答率取得
========================================================= */

async function saveFirstAnswer(
  questionId,
  selectedAnswer,
  isCorrect
) {

  if (
    !supabaseClient
  ) {

    return null;
  }


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
              selectedAnswer

          },
          {

            onConflict:
              "user_id,question_id",

            ignoreDuplicates:
              true
          }
        );


    if (
      insertError

      &&

      insertError.code !==
        "23505"
    ) {

      console.warn(
        "初回回答保存エラー:",
        insertError
      );
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

      console.warn(
        "正答率取得エラー:",
        statsError
      );


      return null;
    }


    if (
      !statsData
    ) {

      return null;
    }


    if (
      Array.isArray(
        statsData
      )
    ) {

      return (
        statsData[0] ||
        null
      );
    }


    return statsData;


  } catch (
    error
  ) {

    console.warn(
      "初回回答処理エラー:",
      error
    );


    return null;
  }
}


/* =========================================================
   物申す
========================================================= */

async function submitQuestionReport(
  questionId,
  reportType,
  message
) {

  if (
    !supabaseClient
  ) {

    return false;
  }


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

      console.warn(
        "物申す投稿エラー:",
        error
      );


      return false;
    }


    return true;


  } catch (
    error
  ) {

    console.warn(
      "物申す投稿処理エラー:",
      error
    );


    return false;
  }
}


/* =========================================================
   メイン
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  function () {


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


    if (
      !quizCard
    ) {

      return;
    }


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


    /*
      今回追加した
      集計用セッションID
    */

    let currentSessionId =
      null;


    let sessionCompleted =
      false;


    /* =====================================================
       開発用モード
    ===================================================== */

    const urlParams =
      new URLSearchParams(
        window.location.search
      );


    const isTestMode =

      urlParams.get(
        "test"
      ) ===
      "1";


    const isResultTestMode =

      urlParams.get(
        "resulttest"
      ) ===
      "1";


    const isDataTestMode =

      urlParams.get(
        "datatest"
      ) ===
      "1";


    const isLastResultTestMode =

      urlParams.get(
        "lastresulttest"
      ) ===
      "1";


    /*
      開発用テストは
      集計データに入れない
    */

    const analyticsEnabled =

      !isTestMode

      &&

      !isResultTestMode

      &&

      !isDataTestMode

      &&

      !isLastResultTestMode;


    /*
      匿名ログインは先に開始するが、
      完了を待たない。

      Supabaseが止まっていても
      クイズ自体は遊べる。
    */

    ensureAnonymousUser();


    /* =====================================================
       イベント登録
    ===================================================== */

    if (
      mainButton
    ) {

      mainButton.addEventListener(
        "click",
        startMainQuizFromBeginning
      );
    }


    if (
      trialButton
    ) {

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


    if (
      resumeButton
    ) {

      resumeButton.addEventListener(
        "click",
        resumeQuiz
      );
    }


    if (
      resumeResetButton
    ) {

      resumeResetButton.addEventListener(
        "click",
        async function () {

          const confirmed =
            confirm(
              "途中までのデータを削除しますか？"
            );


          if (
            !confirmed
          ) {

            return;
          }


          const saved =
            loadProgress();


          if (
            saved?.sessionId
          ) {

            await markQuizSessionAbandoned(
              saved.sessionId
            );
          }


          clearProgress();


          window.location.reload();
        }
      );
    }


    /* =====================================================
       初期表示
    ===================================================== */

    setupPreviousResultArea();


    updateResumeArea();


    if (
      isLastResultTestMode
    ) {

      runLastResultTest();

      return;
    }


    if (
      isDataTestMode
    ) {

      runDataValidationTest();

      return;
    }


    if (
      isResultTestMode
    ) {

      showResultTest();

      return;
    }


    /* =====================================================
       集計用
       quiz_sessions 作成
    ===================================================== */

    async function createQuizSession(
      mode,
      questionCount
    ) {

      if (
        !analyticsEnabled

        ||

        !supabaseClient
      ) {

        return null;
      }


      try {

        const user =
          await ensureAnonymousUser();


        if (
          !user
        ) {

          return null;
        }


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
                  0,

                score:
                  0,

                last_activity_at:
                  new Date()
                    .toISOString()

              }
            )

            .select(
              "id"
            )

            .single();


        if (
          error
        ) {

          /*
            重要：
            集計が失敗しても
            クイズは壊さない
          */

          console.warn(
            "quiz_sessions 作成エラー:",
            error
          );


          return null;
        }


        return (
          data?.id ||
          null
        );


      } catch (
        error
      ) {

        console.warn(
          "quiz_sessions 作成処理エラー:",
          error
        );


        return null;
      }
    }


    /* =====================================================
       1回答ずつ記録
    ===================================================== */

    async function recordQuizAnswer(
      question,
      selectedAnswer,
      isCorrect,
      questionNumber
    ) {

      const sessionId =
        currentSessionId;


      if (
        !analyticsEnabled

        ||

        !supabaseClient

        ||

        !sessionId
      ) {

        return;
      }


      try {

        const user =
          await ensureAnonymousUser();


        if (
          !user
        ) {

          return;
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
                  String(
                    question.id
                  ),

                question_number:
                  questionNumber,

                category:
                  String(
                    question.category ||
                    "その他"
                  ),

                selected_answer:
                  selectedAnswer,

                is_correct:
                  isCorrect

              }
            );


        /*
          UNIQUE(session_id, question_number)
          による重複なら無視
        */

        if (
          error

          &&

          error.code !==
            "23505"
        ) {

          console.warn(
            "quiz_answers 保存エラー:",
            error
          );
        }


      } catch (
        error
      ) {

        console.warn(
          "quiz_answers 保存処理エラー:",
          error
        );
      }
    }


    /* =====================================================
       セッション進捗更新
    ===================================================== */

    async function updateQuizSessionProgress(
      answeredCount,
      currentScore
    ) {

      const sessionId =
        currentSessionId;


      if (
        !analyticsEnabled

        ||

        !supabaseClient

        ||

        !sessionId
      ) {

        return;
      }


      try {

        const user =
          await ensureAnonymousUser();


        if (
          !user
        ) {

          return;
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
                  currentScore,

                last_activity_at:
                  new Date()
                    .toISOString()

              }
            )

            .eq(
              "id",
              sessionId
            )

            .eq(
              "user_id",
              user.id
            );


        if (
          error
        ) {

          console.warn(
            "quiz_sessions 進捗更新エラー:",
            error
          );
        }


      } catch (
        error
      ) {

        console.warn(
          "quiz_sessions 進捗更新処理エラー:",
          error
        );
      }
    }


    /* =====================================================
       最終アクセス更新
    ===================================================== */

    async function touchQuizSession(
      sessionId
    ) {

      if (
        !analyticsEnabled

        ||

        !supabaseClient

        ||

        !sessionId
      ) {

        return;
      }


      try {

        const user =
          await ensureAnonymousUser();


        if (
          !user
        ) {

          return;
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

                last_activity_at:
                  new Date()
                    .toISOString()

              }
            )

            .eq(
              "id",
              sessionId
            )

            .eq(
              "user_id",
              user.id
            );


        if (
          error
        ) {

          console.warn(
            "quiz_sessions activity更新エラー:",
            error
          );
        }


      } catch (
        error
      ) {

        console.warn(
          "quiz_sessions activity更新処理エラー:",
          error
        );
      }
    }


    /* =====================================================
       セッション破棄
    ===================================================== */

    async function markQuizSessionAbandoned(
      sessionId
    ) {

      if (
        !analyticsEnabled

        ||

        !supabaseClient

        ||

        !sessionId
      ) {

        return;
      }


      try {

        const user =
          await ensureAnonymousUser();


        if (
          !user
        ) {

          return;
        }


        const now =
          new Date()
            .toISOString();


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

            .eq(
              "user_id",
              user.id
            )

            .is(
              "completed_at",
              null
            );


        if (
          error
        ) {

          console.warn(
            "quiz_sessions 離脱更新エラー:",
            error
          );
        }


      } catch (
        error
      ) {

        console.warn(
          "quiz_sessions 離脱更新処理エラー:",
          error
        );
      }
    }


    /* =====================================================
       完走記録
    ===================================================== */

    async function completeCurrentQuizSession() {

      const sessionId =
        currentSessionId;


      if (
        sessionCompleted

        ||

        !analyticsEnabled

        ||

        !supabaseClient

        ||

        !sessionId
      ) {

        return;
      }


      sessionCompleted =
        true;


      try {

        const user =
          await ensureAnonymousUser();


        if (
          !user
        ) {

          sessionCompleted =
            false;

          return;
        }


        const now =
          new Date()
            .toISOString();


        const {
          error
        } =

          await supabaseClient

            .from(
              "quiz_sessions"
            )

            .update(
              {

                completed_at:
                  now,

                abandoned_at:
                  null,

                last_activity_at:
                  now,

                answered_count:
                  quizQuestions.length,

                score:
                  score

              }
            )

            .eq(
              "id",
              sessionId
            )

            .eq(
              "user_id",
              user.id
            );


        if (
          error
        ) {

          sessionCompleted =
            false;


          console.warn(
            "quiz_sessions 完走更新エラー:",
            error
          );
        }


      } catch (
        error
      ) {

        sessionCompleted =
          false;


        console.warn(
          "quiz_sessions 完走更新処理エラー:",
          error
        );
      }
    }


    /* =====================================================
       前回結果表示エリア
    ===================================================== */

    function setupPreviousResultArea() {

      if (
        !heroButtons
      ) {

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

      if (
        !previousResultArea
      ) {

        return;
      }


      const saved =
        loadLastResult();


      if (
        !saved
      ) {

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

          <div
            class="previous-result-head"
          >

            <span
              class="previous-result-kicker"
            >
              LAST RESULT
            </span>


            ${
              completedText

                ? `

                  <span
                    class="previous-result-date"
                  >
                    ${escapeHtml(
                      completedText
                    )}
                  </span>

                `

                : ""
            }

          </div>


          <div
            class="previous-result-main"
          >

            <div
              class="previous-result-score"
            >

              <span
                class="previous-result-score-value"
              >
                ${saved.score}
              </span>


              <span
                class="previous-result-score-total"
              >
                /
                ${saved.total}
              </span>

            </div>


            <div
              class="previous-result-rank-block"
            >

              <span
                class="previous-result-rank"
              >
                ${escapeHtml(
                  saved.rank
                )}
              </span>


              <span
                class="previous-result-title"
              >
                ${escapeHtml(
                  saved.title
                )}
              </span>

            </div>

          </div>


          <div
            class="previous-result-footer"
          >
            前回の結果を見る

            <span
              aria-hidden="true"
            >
              →
            </span>

          </div>

        </button>

      `;


      const button =
        document.querySelector(
          "#previous-result-button"
        );


      if (
        button
      ) {

        button.addEventListener(
          "click",
          showPreviousResult
        );
      }
    }


    /* =====================================================
       前回結果保存
    ===================================================== */

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
            new Date()
              .toISOString()

        };


        localStorage.setItem(
          QUIZ_LAST_RESULT_KEY,
          JSON.stringify(
            data
          )
        );


        updatePreviousResultArea();


      } catch (
        error
      ) {

        console.warn(
          "前回結果保存エラー:",
          error
        );
      }
    }


    /* =====================================================
       前回結果読込
    ===================================================== */

    function loadLastResult() {

      try {

        const raw =
          localStorage.getItem(
            QUIZ_LAST_RESULT_KEY
          );


        if (
          !raw
        ) {

          return null;
        }


        let data =
          JSON.parse(
            raw
          );


        if (
          !data

          ||

          typeof data !==
            "object"
        ) {

          return null;
        }


        /*
          古い保存データを
          version 3へ移行
        */

        if (
          data.version ===
            1

          ||

          data.version ===
            2
        ) {

          data = {

            ...data,


            version:
              STORAGE_SCHEMA_VERSION,


            questionSetVersion:
              Number(
                data.questionSetVersion ||
                1
              ),


            categoryStatsVersion:
              Number(
                data.categoryStatsVersion ||
                1
              ),


            categoryStats:

              data.categoryStats

              &&

              typeof data.categoryStats ===
                "object"

                ? data.categoryStats

                : {},


            categoryStatsComplete:

              typeof data
                .categoryStatsComplete ===
                "boolean"

                ? data
                    .categoryStatsComplete

                : true

          };


          localStorage.setItem(
            QUIZ_LAST_RESULT_KEY,
            JSON.stringify(
              data
            )
          );
        }


        if (
          data.version !==
            STORAGE_SCHEMA_VERSION

          ||

          typeof data.score !==
            "number"

          ||

          typeof data.total !==
            "number"

          ||

          typeof data.rank !==
            "string"

          ||

          typeof data.title !==
            "string"
        ) {

          return null;
        }


        if (
          data.categoryStatsVersion !==
            CATEGORY_STATS_VERSION
        ) {

          data = {

            ...data,

            categoryStats:
              {},

            categoryStatsComplete:
              false

          };
        }


        return data;


      } catch (
        error
      ) {

        console.warn(
          "前回結果読込エラー:",
          error
        );


        return null;
      }
    }


    /* =====================================================
       前回結果表示
    ===================================================== */

    function showPreviousResult() {

      const saved =
        loadLastResult();


      if (
        !saved
      ) {

        return;
      }


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
              saved.comment ||
              ""

          },


          statsSource:
            saved.categoryStats ||
            {},


          statsComplete:

            typeof saved
              .categoryStatsComplete ===
              "boolean"

              ? saved
                  .categoryStatsComplete

              : true,


          resultTest:
            false,


          showCompletion:
            saved.total ===
              100

        }
      );
    }


    /* =====================================================
       前回結果テスト
       ?lastresulttest=1
    ===================================================== */

    function runLastResultTest() {

      try {

        const dummyScore =
          69;


        const rankResult =
          safeGetRankResult(
            dummyScore
          );


        localStorage.setItem(
          QUIZ_LAST_RESULT_KEY,

          JSON.stringify(
            {

              version:
                STORAGE_SCHEMA_VERSION,


              questionSetVersion:
                QUESTION_SET_VERSION,


              categoryStatsVersion:
                CATEGORY_STATS_VERSION,


              score:
                dummyScore,


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
                  correct: 19,
                  total: 20
                },

                アイテム: {
                  correct: 16,
                  total: 20
                },

                ダンジョン: {
                  correct: 15,
                  total: 19
                },

                仕様: {
                  correct: 18,
                  total: 36
                },

                その他: {
                  correct: 1,
                  total: 5
                }

              },


              categoryStatsComplete:
                true,


              completedAt:
                new Date()
                  .toISOString()

            }
          )
        );


        window.location.replace(
          window.location.pathname
        );


      } catch (
        error
      ) {

        console.error(
          "前回結果テスト保存エラー:",
          error
        );


        alert(
          "ダミーの前回結果を保存できませんでした。"
        );
      }
    }


    /* =====================================================
       完走日時
    ===================================================== */

    function formatCompletedAt(
      value
    ) {

      if (
        !value
      ) {

        return "";
      }


      const date =
        new Date(
          value
        );


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
      ).format(
        date
      );
    }


    /* =====================================================
       トップへ戻る
    ===================================================== */

    function goToTop() {

      window.location.href =
        window.location.pathname;
    }


    /* =====================================================
       questions.json 読込
    ===================================================== */

    async function loadQuestionsData() {

      const response =
        await fetch(
          "data/questions.json",
          {
            cache:
              "no-store"
          }
        );


      if (
        !response.ok
      ) {

        throw new Error(
          `questions.json を読み込めませんでした。HTTP ${response.status}`
        );
      }


      const data =
        await response.json();


      validateQuestionsData(
        data
      );


      return data;
    }


    /* =====================================================
       questions.json 検証
    ===================================================== */

    function validateQuestionsData(
      data
    ) {

      if (
        !Array.isArray(
          data
        )
      ) {

        throw new Error(
          "questions.json の一番外側は配列にしてください。"
        );
      }


      if (
        data.length ===
          0
      ) {

        throw new Error(
          "questions.json に問題がありません。"
        );
      }


      const seenIds =
        new Set();


      data.forEach(
        function (
          question,
          arrayIndex
        ) {

          const label =
            `配列${arrayIndex + 1}件目`;


          if (
            !question

            ||

            typeof question !==
              "object"
          ) {

            throw new Error(
              `${label}: 問題データがオブジェクトではありません。`
            );
          }


          if (
            question.id ===
              undefined

            ||

            question.id ===
              null

            ||

            String(
              question.id
            ).trim() ===
              ""
          ) {

            throw new Error(
              `${label}: id がありません。`
            );
          }


          const normalizedId =
            String(
              question.id
            );


          if (
            seenIds.has(
              normalizedId
            )
          ) {

            throw new Error(
              `問題ID #${normalizedId}: id が重複しています。`
            );
          }


          seenIds.add(
            normalizedId
          );


          if (
            typeof question.category !==
              "string"

            ||

            question.category
              .trim() ===
              ""
          ) {

            throw new Error(
              `問題ID #${normalizedId}: category が不正です。`
            );
          }


          if (
            !VALID_QUESTION_TYPES
              .includes(
                question.type
              )
          ) {

            throw new Error(
              `問題ID #${normalizedId}: type は single または multiple にしてください。`
            );
          }


          if (
            typeof question.question !==
              "string"

            ||

            question.question
              .trim() ===
              ""
          ) {

            throw new Error(
              `問題ID #${normalizedId}: question が空です。`
            );
          }


          if (
            !Array.isArray(
              question.choices
            )

            ||

            question.choices.length <
              2
          ) {

            throw new Error(
              `問題ID #${normalizedId}: choices が不正です。`
            );
          }


          question.choices.forEach(
            function (
              choice,
              choiceIndex
            ) {

              if (
                typeof choice !==
                  "string"

                ||

                choice.trim() ===
                  ""
              ) {

                throw new Error(
                  `問題ID #${normalizedId}: 選択肢${choiceIndex + 1}が空です。`
                );
              }
            }
          );


          /* =====================
             単一選択
          ===================== */

          if (
            question.type ===
              "single"
          ) {

            if (
              !Number.isInteger(
                question.answer
              )

              ||

              question.answer <
                0

              ||

              question.answer >=
                question.choices.length
            ) {

              throw new Error(
                `問題ID #${normalizedId}: answer が不正です。`
              );
            }
          }


          /* =====================
             複数選択
          ===================== */

          if (
            question.type ===
              "multiple"
          ) {

            if (
              !Array.isArray(
                question.answer
              )

              ||

              question.answer.length ===
                0
            ) {

              throw new Error(
                `問題ID #${normalizedId}: multiple の answer は配列にしてください。`
              );
            }


            const uniqueAnswers =
              new Set(
                question.answer
              );


            if (
              uniqueAnswers.size !==
                question.answer.length
            ) {

              throw new Error(
                `問題ID #${normalizedId}: answer に同じ番号が重複しています。`
              );
            }


            question.answer.forEach(
              function (
                answerIndex
              ) {

                if (
                  !Number.isInteger(
                    answerIndex
                  )

                  ||

                  answerIndex <
                    0

                  ||

                  answerIndex >=
                    question.choices.length
                ) {

                  throw new Error(
                    `問題ID #${normalizedId}: answer の番号が選択肢の範囲外です。`
                  );
                }
              }
            );
          }


          /*
            explanation は
            空文字でも許可。

            内容がまだ未入力の問題があっても
            アプリ全体を止めない。
          */

          if (
            question.explanation !==
              undefined

            &&

            typeof question.explanation !==
              "string"
          ) {

            throw new Error(
              `問題ID #${normalizedId}: explanation が不正です。`
            );
          }


          if (
            question.instruction !==
              undefined

            &&

            typeof question.instruction !==
              "string"
          ) {

            throw new Error(
              `問題ID #${normalizedId}: instruction が不正です。`
            );
          }
        }
      );
    }


    /* =====================================================
       問題データエラー画面
    ===================================================== */

    function showQuestionDataError(
      error,
      isTest = false
    ) {

      console.error(
        "問題データエラー:",
        error
      );


      quizCard.innerHTML = `

        <div
          class="result-screen"
        >

          <p
            class="hero-label"
          >
            ${
              isTest
                ? "DATA TEST"
                : "ERROR"
            }
          </p>


          <h1>
            ${
              isTest
                ? "データ検証テスト"
                : "問題データエラー"
            }
          </h1>


          <p
            class="explanation"
          >
            ${escapeHtml(
              error?.message ||
              "問題データを読み込めませんでした。"
            )}
          </p>


          <button
            class="
              restart-button
              error-top-button
            "
            type="button"
          >
            トップ画面へ戻る
          </button>

        </div>

      `;


      const button =
        document.querySelector(
          ".error-top-button"
        );


      if (
        button
      ) {

        button.addEventListener(
          "click",
          goToTop
        );
      }
    }


    /* =====================================================
       データ検証テスト
       ?datatest=1
    ===================================================== */

    function runDataValidationTest() {

      const intentionallyBrokenData = [

        {

          id:
            "TEST-BROKEN",

          category:
            "仕様",

          type:
            "unknown",

          question:
            "type異常テスト",

          choices: [
            "A",
            "B"
          ],

          answer:
            0,

          explanation:
            "テスト"

        }

      ];


      try {

        validateQuestionsData(
          intentionallyBrokenData
        );


        throw new Error(
          "不正データを検出できませんでした。"
        );


      } catch (
        error
      ) {

        showQuestionDataError(
          error,
          true
        );
      }
    }


    /* =====================================================
       クイズ開始
    ===================================================== */

    async function startQuiz(
      questionCount = 100,
      mode = "main"
    ) {

      quizMode =
        mode;


      sessionCompleted =
        false;


      currentSessionId =
        null;


      try {

        const allQuestions =
          await loadQuestionsData();


        quizQuestions =
          shuffleArray(
            [
              ...allQuestions
            ]
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


        /*
          集計用セッションを作る。

          失敗した場合は null になるだけで
          クイズはそのまま続く。
        */

        currentSessionId =
          await createQuizSession(
            mode,
            quizQuestions.length
          );


        if (
          quizMode ===
            "main"
        ) {

          saveProgress(
            0
          );
        }


        showQuestion();


      } catch (
        error
      ) {

        showQuestionDataError(
          error
        );
      }
    }


    /* =====================================================
       問題表示
    ===================================================== */

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


      if (
        !question
      ) {

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
          )

          /

          quizQuestions.length

        ) * 100;


      quizCard.innerHTML = `

        <div
          class="question-meta"
        >

          <span>
            第${currentQuestionIndex + 1}問
            /
            全${quizQuestions.length}問
          </span>


          <div
            class="question-meta-right"
          >

            <span
              class="question-id"
            >
              問題ID
              #${escapeHtml(
                question.id
              )}
            </span>


            <span
              class="category"
            >
              ${escapeHtml(
                question.category
              )}
            </span>

          </div>

        </div>


        <div
          class="progress-wrap"
        >

          <div
            class="progress-bar"
            style="
              width:
                ${progress}%;
            "
          ></div>

        </div>


        ${
          quizMode ===
            "main"

            ? `

              <div
                class="pause-row"
              >

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
            "multiple"

          &&

          question.instruction

            ? `

              <div
                class="question-instruction"
              >
                ${escapeHtml(
                  question.instruction
                )}
              </div>

            `

            : ""
        }


        <div
          class="choices"
        >

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
                    type="button"
                  >

                    <span
                      class="choice-label"
                    >
                      ${String.fromCharCode(
                        65 +
                        index
                      )}
                    </span>


                    <span
                      class="choice-text"
                    >
                      ${escapeHtml(
                        choice
                      )}
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
                type="button"
                disabled
              >
                回答する
              </button>

            `

            : ""
        }


        <div
          id="answer-area"
        ></div>

      `;


      /* ===================================================
         中断
      =================================================== */

      if (
        quizMode ===
          "main"
      ) {

        const pauseButton =
          document.querySelector(
            ".pause-button"
          );


        if (
          pauseButton
        ) {

          pauseButton.addEventListener(
            "click",
            async function () {

              if (
                currentSessionId
              ) {

                await touchQuizSession(
                  currentSessionId
                );
              }


              goToTop();
            }
          );
        }
      }


      const choiceButtons =

        [
          ...document
            .querySelectorAll(
              ".choice-button"
            )
        ];


      /* ===================================================
         複数選択
      =================================================== */

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


                if (
                  submitButton
                ) {

                  submitButton.disabled =
                    selectedAnswers.size ===
                      0;
                }
              }
            );
          }
        );


        if (
          submitButton
        ) {

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
                )

                .sort(
                  function (
                    a,
                    b
                  ) {

                    return (
                      a -
                      b
                    );
                  }
                );


              checkAnswer(
                answers
              );
            }
          );
        }


      /* ===================================================
         単一選択
      =================================================== */

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


    /* =====================================================
       正誤判定
    ===================================================== */

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
          answeredQuestionIndex
        ];


      const choiceButtons =

        [
          ...document
            .querySelectorAll(
              ".choice-button"
            )
        ];


      const answerArea =
        document.querySelector(
          "#answer-area"
        );


      const submitButton =
        document.querySelector(
          ".submit-answer-button"
        );


      if (
        !question

        ||

        !answerArea
      ) {

        return;
      }


      if (
        submitButton
      ) {

        submitButton.disabled =
          true;
      }


      const correctAnswers =

        (
          Array.isArray(
            question.answer
          )

            ? [
                ...question.answer
              ]

            : [
                question.answer
              ]
        )

        .sort(
          function (
            a,
            b
          ) {

            return (
              a -
              b
            );
          }
        );


      const selectedAnswers =

        (
          Array.isArray(
            selectedAnswer
          )

            ? [
                ...selectedAnswer
              ]

            : [
                selectedAnswer
              ]
        )

        .sort(
          function (
            a,
            b
          ) {

            return (
              a -
              b
            );
          }
        );


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
          answeredQuestionIndex +
          1
        );
      }


      /* ===================================================
         選択肢の色
      =================================================== */

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


      const explanation =

        typeof question.explanation ===
          "string"

        &&

        question.explanation.trim()

          ? question.explanation

          : "解説は準備中です。";


      /* ===================================================
         回答結果
         まず画面を即表示する
      =================================================== */

      answerArea.innerHTML = `

        <div
          class="
            result-box
            ${resultClass}
          "
        >

          <div
            class="result-title"
          >
            ${resultTitle}
          </div>


          <div
            class="correct-answer"
          >

            <span
              class="correct-answer-title"
            >
              正解
            </span>


            ${correctAnswers

              .map(
                function (
                  answerIndex
                ) {

                  return `

                    <span
                      class="correct-answer-label"
                    >
                      ${String.fromCharCode(
                        65 +
                        answerIndex
                      )}
                    </span>


                    <span
                      class="correct-answer-text"
                    >
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


          <div
            class="explanation-title"
          >
            解説
          </div>


          <p
            class="explanation"
          >
            ${escapeHtml(
              explanation
            )}
          </p>


          <div
            class="community-stats-slot"
          ></div>


          <div
            class="current-score"
          >

            <span
              class="current-score-label"
            >
              現在の成績
            </span>


            <span
              class="current-score-number"
            >
              ${score}
              /
              ${answeredQuestionIndex + 1}
            </span>

          </div>


          <div
            class="report-section"
          >

            <button
              class="report-toggle-button"
              type="button"
            >
              この問題に物申す
            </button>


            <div
              class="
                report-form
                hidden
              "
            >

              <div
                class="report-heading"
              >
                この問題のどこが気になりますか？
              </div>


              <select
                class="report-type"
              >

                <option
                  value=""
                >
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


              <p
                class="report-note"
              >
                投稿内容は管理者に送信されます。
                一般には公開されません。
              </p>


              <button
                class="report-submit-button"
                type="button"
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
          class="
            next-button
            answer-next-button
          "
          type="button"
        >

          ${
            answeredQuestionIndex +
              1 <
            quizQuestions.length

              ? "次の問題へ"

              : "結果を見る"
          }

        </button>

      `;


      setupAnswerResultEvents(
        question
      );


      /*
        ここから下はSupabase。

        重要：
        正誤表示をした後に実行する。

        Supabaseが遅い・失敗した等で
        クイズ画面を止めない。
      */

      const statsPromise =

        analyticsEnabled

          ? saveFirstAnswer(
              question.id,
              selectedAnswer,
              isCorrect
            )

          : Promise.resolve(
              null
            );


      /*
        1回答記録
      */

      if (
        analyticsEnabled

        &&

        currentSessionId
      ) {

        void recordQuizAnswer(
          question,
          selectedAnswer,
          isCorrect,
          answeredQuestionIndex +
            1
        );


        void updateQuizSessionProgress(
          answeredQuestionIndex +
            1,
          score
        );
      }


      /*
        正答率取得後、
        まだ同じ回答結果画面なら表示
      */

      statsPromise.then(
        function (
          stats
        ) {

          const slot =
            document.querySelector(
              ".community-stats-slot"
            );


          if (
            !slot

            ||

            !slot.isConnected

            ||

            !stats
          ) {

            return;
          }


          const accuracy =
            Number(
              stats.accuracy
            );


          const attempts =
            Number(
              stats.attempts
            );


          const correct =
            Number(
              stats.correct
            );


          if (
            !Number.isFinite(
              accuracy
            )

            ||

            !Number.isFinite(
              attempts
            )

            ||

            !Number.isFinite(
              correct
            )
          ) {

            return;
          }


          slot.innerHTML = `

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
                ${Math.round(
                  accuracy
                )}%
              </div>


              <div
                class="community-stats-detail"
              >
                ${attempts}人中
                ${correct}人正解
              </div>

            </div>

          `;
        }
      );
    }


    /* =====================================================
       回答後イベント
    ===================================================== */

    function setupAnswerResultEvents(
      question
    ) {

      const nextButton =
        document.querySelector(
          ".answer-next-button"
        );


      if (
        nextButton
      ) {

        nextButton.addEventListener(
          "click",
          nextQuestion
        );
      }


      /* ===================================================
         物申す 開閉
      =================================================== */

      const reportToggleButton =
        document.querySelector(
          ".report-toggle-button"
        );


      const reportForm =
        document.querySelector(
          ".report-form"
        );


      if (
        reportToggleButton

        &&

        reportForm
      ) {

        reportToggleButton.addEventListener(
          "click",
          function () {

            reportForm.classList.toggle(
              "hidden"
            );
          }
        );
      }


      /* ===================================================
         物申す 送信
      =================================================== */

      const reportSubmitButton =
        document.querySelector(
          ".report-submit-button"
        );


      if (
        reportSubmitButton
      ) {

        reportSubmitButton.addEventListener(
          "click",
          async function () {

            const reportTypeElement =
              document.querySelector(
                ".report-type"
              );


            const reportMessageElement =
              document.querySelector(
                ".report-message"
              );


            const reportStatus =
              document.querySelector(
                ".report-status"
              );


            if (
              !reportTypeElement

              ||

              !reportMessageElement

              ||

              !reportStatus
            ) {

              return;
            }


            const reportType =
              reportTypeElement.value;


            const message =
              reportMessageElement
                .value
                .trim();


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
      }
    }


    /* =====================================================
       次の問題
    ===================================================== */

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


    /* =====================================================
       結果画面テスト
       ?resulttest=1
    ===================================================== */

    function showResultTest() {

      const testScore =
        69;


      renderMainResultScreen(
        {

          scoreValue:
            testScore,


          totalValue:
            100,


          rankResult:
            safeGetRankResult(
              testScore
            ),


          statsSource: {

            モンスター: {
              correct: 19,
              total: 20
            },

            アイテム: {
              correct: 16,
              total: 20
            },

            ダンジョン: {
              correct: 15,
              total: 19
            },

            仕様: {
              correct: 18,
              total: 36
            },

            その他: {
              correct: 1,
              total: 5
            }

          },


          statsComplete:
            true,


          resultTest:
            true,


          showCompletion:
            false

        }
      );
    }


    /* =====================================================
       結果
    ===================================================== */

    function showResult() {

      /*
        Supabase完走処理は
        結果表示を待たせない
      */

      void completeCurrentQuizSession();


      /* ===================================================
         お試し
      =================================================== */

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


      /* ===================================================
         本番
      =================================================== */

      const rankResult =
        safeGetRankResult(
          score
        );


      const isOfficialFullCompletion =

        quizMode ===
          "main"

        &&

        analyticsEnabled

        &&

        quizQuestions.length ===
          100;


      if (
        isOfficialFullCompletion
      ) {

        saveLastResult(
          rankResult
        );
      }


      clearProgress();


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


    /* =====================================================
       結果画面共通
    ===================================================== */

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


      quizCard.innerHTML = `

        <div
          class="result-screen"
        >

          <p
            class="hero-label"
          >
            ${
              resultTest
                ? "RESULT TEST"
                : "RESULT"
            }
          </p>


          <div
            class="result-brand"
          >

            <div
              class="result-brand-title"
            >

              <span
                class="title-asuka"
              >
                アスカ見参
              </span>


              <span
                class="title-haijin"
              >
                廃人検定
              </span>

            </div>


            <h1
              class="result-heading"
            >
              検定結果
            </h1>

          </div>


          ${
            resultTest

              ? `

                <div
                  style="
                    margin:
                      -12px 0
                      16px;

                    color:
                      #888;

                    font-size:
                      12px;

                    letter-spacing:
                      0.05em;
                  "
                >
                  開発用結果画面テスト
                </div>

              `

              : ""
          }


          <div
            class="final-score"
          >

            ${scoreValue}

            <span>
              /
              ${totalValue}
            </span>

          </div>


          <div
            class="percentage"
          >
            正答率
            ${percentage}%
          </div>


          ${
            showCompletion

              ? `

                <div
                  class="full-completion-badge"
                >

                  <span
                    class="full-completion-en"
                  >
                    ALL 100 QUESTIONS COMPLETE
                  </span>


                  <span
                    class="full-completion-title"
                  >
                    全100問 完走
                  </span>

                </div>

              `

              : ""
          }


          <div
            class="rank-panel"
          >

            <div
              class="rank-label"
            >
              あなたのランク・称号
            </div>


            <div
              class="rank-grade"
            >
              ${escapeHtml(
                rankResult.rank
              )}
            </div>


            <div
              class="rank"
            >
              ${escapeHtml(
                rankResult.title
              )}
            </div>


            <div
              class="rank-comment"
            >
              ${rankResult.comment || ""}
            </div>

          </div>


          ${renderCategoryStatsFromData(
            statsSource,
            statsComplete
          )}


          ${
            resultTest

              ? `

                <button
                  class="
                    restart-button
                    result-test-back-button
                  "
                  type="button"
                >
                  通常画面へ戻る
                </button>

              `

              : `

                <button
                  class="
                    restart-button
                    result-top-button
                  "
                  type="button"
                >
                  トップ画面へ戻る
                </button>

              `
          }

        </div>

      `;


      const backButton =
        document.querySelector(

          resultTest

            ? ".result-test-back-button"

            : ".result-top-button"
        );


      if (
        backButton
      ) {

        backButton.addEventListener(
          "click",
          goToTop
        );
      }
    }


    /* =====================================================
       お試し結果
    ===================================================== */

    function showTrialResult(
      percentage
    ) {

      quizCard.innerHTML = `

        <div
          class="result-screen"
        >

          <p
            class="hero-label"
          >
            TRIAL RESULT
          </p>


          <div
            class="result-brand"
          >

            <div
              class="result-brand-title"
            >

              <span
                class="title-asuka"
              >
                アスカ見参
              </span>


              <span
                class="title-haijin"
              >
                廃人検定
              </span>

            </div>


            <h1
              class="result-heading"
            >
              お試し結果
            </h1>

          </div>


          <div
            class="final-score"
          >

            ${score}

            <span>
              /
              5
            </span>

          </div>


          <div
            class="percentage"
          >
            正答率
            ${percentage}%
          </div>


          <div
            class="trial-complete-panel"
          >

            <div
              class="trial-complete-title"
            >
              5問完走
            </div>


            <p
              class="trial-complete-text"
            >
              ここまでは、まだウォーミングアップ。
              <br>

              正式なランク・称号は、
              <strong>
                全100問
              </strong>
              で決まります。
            </p>


            <p
              class="trial-complete-warning"
            >
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

            <span
              class="trial-main-cta-main"
            >
              廃人検定100問に挑戦する
            </span>


            <span
              class="trial-main-cta-sub"
            >
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


      const mainChallengeButton =
        document.querySelector(
          ".main-challenge-button"
        );


      const trialAgainButton =
        document.querySelector(
          ".trial-again-button"
        );


      if (
        mainChallengeButton
      ) {

        mainChallengeButton.addEventListener(
          "click",
          startMainQuizFromBeginning
        );
      }


      if (
        trialAgainButton
      ) {

        trialAgainButton.addEventListener(
          "click",
          function () {

            startQuiz(
              5,
              "trial"
            );
          }
        );
      }
    }


    /* =====================================================
       本番を最初から開始
    ===================================================== */

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

          await markQuizSessionAbandoned(
            saved.sessionId
          );
        }


        clearProgress();
      }


      startQuiz(
        isTestMode
          ? 5
          : 100,

        "main"
      );
    }


    /* =====================================================
       途中保存
    ===================================================== */

    function saveProgress(
      nextQuestionIndex
    ) {

      if (
        quizMode !==
          "main"

        ||

        isResultTestMode

        ||

        isDataTestMode

        ||

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


          sessionId:
            currentSessionId,


          questionIds:
            quizQuestions.map(
              function (
                question
              ) {

                return (
                  question.id
                );
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


          savedAt:
            new Date()
              .toISOString()

        };


        localStorage.setItem(
          QUIZ_SAVE_KEY,
          JSON.stringify(
            data
          )
        );


        updateResumeArea();


      } catch (
        error
      ) {

        console.warn(
          "途中データ保存エラー:",
          error
        );
      }
    }


    /* =====================================================
       途中データ読込
    ===================================================== */

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


        let data =
          JSON.parse(
            raw
          );


        if (
          !data

          ||

          typeof data !==
            "object"
        ) {

          return null;
        }


        /*
          version 1 / 2
          ↓
          version 3
        */

        if (
          data.version ===
            1

          ||

          data.version ===
            2
        ) {

          data = {

            ...data,


            version:
              STORAGE_SCHEMA_VERSION,


            questionSetVersion:
              Number(
                data.questionSetVersion ||
                1
              ),


            categoryStatsVersion:
              Number(
                data.categoryStatsVersion ||
                1
              ),


            sessionId:
              data.sessionId ||
              null,


            categoryStats:

              data.categoryStats

              &&

              typeof data.categoryStats ===
                "object"

                ? data.categoryStats

                : {},


            categoryStatsComplete:

              typeof data
                .categoryStatsComplete ===
                "boolean"

                ? data
                    .categoryStatsComplete

                : Number(
                    data.currentQuestionIndex ||
                    0
                  ) ===
                  0

          };


          localStorage.setItem(
            QUIZ_SAVE_KEY,
            JSON.stringify(
              data
            )
          );
        }


        if (
          data.version !==
            STORAGE_SCHEMA_VERSION

          ||

          !Array.isArray(
            data.questionIds
          )

          ||

          data.questionIds.length ===
            0

          ||

          typeof data
            .currentQuestionIndex !==
            "number"

          ||

          typeof data.score !==
            "number"

          ||

          typeof data
            .questionSetVersion !==
            "number"

          ||

          typeof data
            .categoryStatsVersion !==
            "number"
        ) {

          return null;
        }


        /*
          カテゴリ集計仕様だけ変わった場合は
          クイズは再開できる。

          ただし古いカテゴリ集計は表示しない。
        */

        if (
          data.categoryStatsVersion !==
            CATEGORY_STATS_VERSION
        ) {

          data = {

            ...data,


            categoryStatsVersion:
              CATEGORY_STATS_VERSION,


            categoryStats:
              {},


            categoryStatsComplete:
              false

          };


          localStorage.setItem(
            QUIZ_SAVE_KEY,
            JSON.stringify(
              data
            )
          );
        }


        return data;


      } catch (
        error
      ) {

        console.warn(
          "途中データ読込エラー:",
          error
        );


        return null;
      }
    }


    /* =====================================================
       途中データ削除
    ===================================================== */

    function clearProgress() {

      try {

        localStorage.removeItem(
          QUIZ_SAVE_KEY
        );


      } catch (
        error
      ) {

        console.warn(
          "途中データ削除エラー:",
          error
        );
      }


      updateResumeArea();
    }


    /* =====================================================
       再開ボタン表示更新
    ===================================================== */

    function updateResumeArea() {

      if (
        !resumeArea

        ||

        !resumeDetail
      ) {

        return;
      }


      const saved =
        loadProgress();


      if (
        !saved
      ) {

        resumeArea.classList.add(
          "hidden"
        );


        if (
          heroButtons
        ) {

          heroButtons.classList.remove(
            "hidden"
          );
        }


        if (
          trialNote
        ) {

          trialNote.classList.remove(
            "hidden"
          );
        }


        return;
      }


      resumeArea.classList.remove(
        "hidden"
      );


      if (
        heroButtons
      ) {

        heroButtons.classList.add(
          "hidden"
        );
      }


      if (
        trialNote
      ) {

        trialNote.classList.add(
          "hidden"
        );
      }


      if (
        saved.questionSetVersion !==
          QUESTION_SET_VERSION
      ) {

        resumeDetail.textContent =
          "問題データ更新済み・この途中データは再開できません";


        return;
      }


      const total =
        saved
          .questionIds
          .length;


      if (
        saved.currentQuestionIndex >=
          total
      ) {

        resumeDetail.textContent =
          `全${total}問回答済み・結果を見る`;


      } else {

        resumeDetail.textContent =
          `第${saved.currentQuestionIndex + 1}問から再開・現在 ${saved.score}点`;
      }
    }


    /* =====================================================
       再開
    ===================================================== */

    async function resumeQuiz() {

      const saved =
        loadProgress();


      if (
        !saved
      ) {

        updateResumeArea();

        return;
      }


      if (
        saved.questionSetVersion !==
          QUESTION_SET_VERSION
      ) {

        alert(
          "問題データが更新されたため、この途中データは再開できません。途中データを削除して、最初から挑戦してください。"
        );


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
                  String(
                    id
                  )
                )
              );
            }
          );


        if (
          restoredQuestions.some(
            function (
              question
            ) {

              return (
                !question
              );
            }
          )
        ) {

          alert(
            "問題データが更新されたため、この途中データは再開できません。途中データを削除して、最初から挑戦してください。"
          );


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

          saved.categoryStats

          &&

          typeof saved.categoryStats ===
            "object"

            ? saved.categoryStats

            : {};


        categoryStatsComplete =

          typeof saved
            .categoryStatsComplete ===
            "boolean"

            ? saved
                .categoryStatsComplete

            : currentQuestionIndex ===
                0;


        quizMode =
          "main";


        answerLocked =
          false;


        sessionCompleted =
          false;


        currentSessionId =
          saved.sessionId ||
          null;


        /*
          古い途中データで
          sessionId がない場合は
          新しく集計セッションを作る
        */

        if (
          !currentSessionId
        ) {

          currentSessionId =
            await createQuizSession(
              "main",
              quizQuestions.length
            );


          if (
            currentSessionId
          ) {

            await updateQuizSessionProgress(
              currentQuestionIndex,
              score
            );


            saveProgress(
              currentQuestionIndex
            );
          }


        } else {

          await touchQuizSession(
            currentSessionId
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


      } catch (
        error
      ) {

        console.error(
          "再開エラー:",
          error
        );


        showQuestionDataError(
          error
        );
      }
    }


    /* =====================================================
       カテゴリ
    ===================================================== */

    function getCategoryGroup(
      category
    ) {

      const raw =
        String(
          category ||
          "その他"
        ).trim();


      return (

        VALID_QUESTION_CATEGORIES
          .includes(
            raw
          )

          ? raw

          : "その他"

      );
    }


    function updateCategoryStats(
      category,
      isCorrect
    ) {

      const group =
        getCategoryGroup(
          category
        );


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


    /* =====================================================
       カテゴリ別正答率
    ===================================================== */

    function renderCategoryStatsFromData(
      statsSource,
      statsComplete = true
    ) {

      if (
        !statsComplete
      ) {

        return `

          <section
            class="category-results"
          >

            <div
              class="category-results-title"
            >
              カテゴリ別正答率
            </div>


            <p
              class="category-results-note"
            >
              この挑戦はカテゴリ集計機能の追加前に開始されたため、
              カテゴリ別正答率は表示できません。
            </p>

          </section>

        `;
      }


      if (
        !statsSource

        ||

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

              const stats =
                entry[1];


              return (

                stats

                &&

                Number(
                  stats.total
                ) >
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

        <section
          class="category-results"
        >

          <div
            class="category-results-title"
          >
            カテゴリ別正答率
          </div>


          <div
            class="category-results-list"
          >

            ${entries

              .map(
                function (
                  entry
                ) {

                  const category =
                    entry[0];


                  const stats =
                    entry[1];


                  const correct =
                    Number(
                      stats.correct
                    ) ||
                    0;


                  const total =
                    Number(
                      stats.total
                    ) ||
                    0;


                  const accuracy =

                    total >
                      0

                      ? Math.round(
                          (
                            correct /
                            total
                          ) *
                          100
                        )

                      : 0;


                  let barBackground;


                  let accuracyColor;


                  if (
                    accuracy >=
                      80
                  ) {

                    barBackground =
                      "linear-gradient(90deg, #b88a1d, #f0d26d)";


                    accuracyColor =
                      "#f0d26d";


                  } else if (
                    accuracy >=
                      50
                  ) {

                    barBackground =
                      "linear-gradient(90deg, #b96818, #e69a35)";


                    accuracyColor =
                      "#e69a35";


                  } else {

                    barBackground =
                      "linear-gradient(90deg, #9f3733, #df625b)";


                    accuracyColor =
                      "#ef7772";
                  }


                  return `

                    <div
                      class="category-result-row"
                    >

                      <div
                        class="category-result-top"
                      >

                        <span
                          class="category-result-name"
                        >
                          ${escapeHtml(
                            category
                          )}
                        </span>


                        <span
                          class="category-result-score"
                        >

                          ${correct}
                          /
                          ${total}


                          <strong
                            class="category-result-accuracy"
                            style="
                              color:
                                ${accuracyColor};
                            "
                          >
                            ${accuracy}%
                          </strong>

                        </span>

                      </div>


                      <div
                        class="category-result-bar-wrap"
                      >

                        <div
                          class="category-result-bar"
                          style="
                            width:
                              ${accuracy}%;

                            background:
                              ${barBackground};
                          "
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


    /* =====================================================
       ランク取得
    ===================================================== */

    function safeGetRankResult(
      scoreValue
    ) {

      if (
        typeof window
          .getRankResult ===
          "function"
      ) {

        return window
          .getRankResult(
            scoreValue
          );
      }


      if (
        typeof getRankResult ===
          "function"
      ) {

        return getRankResult(
          scoreValue
        );
      }


      /*
        rank.jsが読み込めなかった場合も
        JavaScript全体を落とさない
      */

      return {

        rank:
          "-",


        title:
          "ランク判定を読み込めませんでした",


        comment:
          "rank.js が正しく読み込まれているか確認してください。"

      };
    }


    /* =====================================================
       シャッフル
    ===================================================== */

    function shuffleArray(
      array
    ) {

      for (
        let i =
          array.length -
          1;

        i >
          0;

        i--
      ) {

        const j =
          Math.floor(
            Math.random() *
            (
              i +
              1
            )
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


    /* =====================================================
       HTMLエスケープ
    ===================================================== */

    function escapeHtml(
      value
    ) {

      return String(
        value
      )

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
