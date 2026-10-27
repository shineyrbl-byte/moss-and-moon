// Learn to play: four tiny hand-made puzzles that teach the logic puzzles step by step. Each has one answer (the tests
// check). Pure, so the page and tests share it.
export type Lesson = {
  id: string; title: string; href: string; n: number; kind: "values" | "stars" | "bikes" | "path";
  intro: string; tips: string[]; solution: number[]; given: number[]; regions?: number[]; rows?: number[]; cols?: number[]; marks?: number[];
};

export const LESSONS: Lesson[] = [
  {
    id: "sudoku", title: "Mini sudoku", href: "/sudoku", n: 4, kind: "values",
    intro: "Every row, every column and every 2×2 box needs each of the four treats once.",
    tips: [
      "Start with the top row: it already has ☕, 🥐 and 🍵, so its gap must be 🍰.",
      "Now look at a box (each 2×2 corner). Once the 🍰 is in, the top-right box has 🍰, 🍵 and ☕. Which treat is it missing?",
      "When a square has only one treat left that fits its row, column and box, that's the answer. Keep going square by square.",
    ],
    solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1],
    given: [1, 2, 0, 4, 0, 4, 1, 0, 0, 1, 4, 0, 4, 0, 0, 1],
  },
  {
    id: "stars", title: "Sugar stars", href: "/sugar-stars", n: 5, kind: "stars",
    intro: "Here it's one star in every row, every column and every outlined tray, and stars can't touch, not even corner to corner. (The daily one is two of each on a 10×10.)",
    tips: [
      "Start with the smallest tray: just two squares in the second row. Its star must be in one of them.",
      "Once a star is down, its whole row, column and the eight squares around it can't have another. Cross them off in your head.",
      "The tray in the top left covers most of the first two rows. Where can its star go without touching the one you've found?",
    ],
    solution: [2, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0],
    given: Array(25).fill(0),
    regions: [0, 0, 0, 0, 2, 0, 0, 1, 1, 2, 3, 3, 3, 2, 2, 3, 3, 3, 4, 2, 3, 3, 3, 4, 2],
  },
  {
    id: "bikes", title: "Delivery bikes", href: "/delivery-bikes", n: 4, kind: "bikes",
    intro: "Find one bike 2 squares long and two scooters of 1. The numbers say how many squares in each row and column are bike, and nothing touches, even corner to corner.",
    tips: [
      "Rows and columns with 0 are all road. That clears a lot straight away. The square with a grey dot is given as road.",
      "The top row needs 2 squares of bike side by side: that's the long bike.",
      "With the long bike down, the squares around it are road. Now fit the two scooters into the counts that are left.",
    ],
    solution: [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0],
    given: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], rows: [2, 0, 1, 1], cols: [2, 1, 0, 1],
  },
  {
    id: "zip", title: "Zip path", href: "/zip-path", n: 3, kind: "path",
    intro: "Draw one line through every square, moving up, down, left or right, passing the numbers in order. Start on 1.",
    tips: [
      "2 is right next to 1, so that's your first step.",
      "3 is in the middle. You can't go straight there from 2 and still fill every square, so take the long way round the top right.",
      "The last number, 4, has to be the very last square of your line.",
    ],
    solution: [0, 1, 2, 5, 4, 3, 6, 7, 8], given: [], marks: [1, 2, 0, 0, 3, 0, 0, 0, 4],
  },
];

/** Is this answer right for the lesson? Values and marks compare square by square (crossed-off road counts as empty). */
export function lessonSolved(l: Lesson, answer: number[]) {
  if (l.kind === "path") return answer.length === l.solution.length && answer.every((v, i) => v === l.solution[i]);
  return l.solution.every((v, i) => (l.kind === "bikes" ? (v === 2) === (answer[i] === 2) : v === answer[i]));
}
/** Squares that are wrong right now (for the "check" button) */
export const lessonWrong = (l: Lesson, answer: number[]) => (l.kind === "path" ? [] : answer.flatMap((v, i) => (v && v !== l.solution[i] && !(l.kind === "bikes" && v === 1 && l.solution[i] !== 2) ? [i] : [])));
