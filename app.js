document.addEventListener("DOMContentLoaded", function () {
  const startButton = document.querySelector(".start-button");
  const quizCard = document.querySelector(".quiz-card");

  startButton.addEventListener("click", async function () {
    try {
      const response = await fetch("data/questions.json");

      if (!response.ok) {
        throw new Error("問題データを読み込めませんでした。");
      }

      const questions = await response.json();

      const randomIndex = Math.floor(Math.random() * questions.length);
      const question = questions[randomIndex];

      quizCard.innerHTML = `
        <p>問題 ${question.id}</p>

        <h2>${question.question}</h2>

        <div class="choices">
          ${question.choices
            .map(
              (choice, index) => `
                <button class="choice-button" data-index="${index}">
                  ${choice}
                </button>
              `
            )
            .join("")}
        </div>
      `;
    } catch (error) {
      quizCard.innerHTML = `
        <h2>エラー</h2>
        <p>問題データを読み込めませんでした。</p>
      `;

      console.error(error);
    }
  });
});
