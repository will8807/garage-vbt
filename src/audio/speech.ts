const NUMBER_WORDS: Record<number, string> = {
  0: 'zero',
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
  12: 'twelve',
  13: 'thirteen',
  14: 'fourteen',
  15: 'fifteen',
  16: 'sixteen',
  17: 'seventeen',
  18: 'eighteen',
  19: 'nineteen',
  20: 'twenty',
};

export function numberToWord(n: number): string {
  if (NUMBER_WORDS[n]) return NUMBER_WORDS[n];
  if (n > 20 && n < 100) {
    const tens = Math.floor(n / 10) * 10;
    const ones = n % 10;
    const tensWord = NUMBER_WORDS[tens] ?? String(tens);
    return ones ? `${tensWord} ${NUMBER_WORDS[ones]}` : tensWord;
  }
  return String(n);
}

export async function sayNumber(n: number): Promise<void> {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  await new Promise<void>((resolve) => {
    const utter = new SpeechSynthesisUtterance(numberToWord(n));
    utter.rate = 1.1;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    synth.speak(utter);
  });
}
