/**
 * The small amount of formatting a seller actually types.
 *
 * WHAT THIS IS FIXING. ToolVault's description ends "discounts of up to
 * **50%**" — on the page, asterisks and all. Somebody wrote what they write
 * everywhere else, WhatsApp included, and the site printed it back at them.
 * The same person's paragraph breaks were being collapsed, which is why the
 * whole description arrived as one block.
 *
 * DELIBERATELY NOT MARKDOWN. No links, no images, no HTML, no headings — just
 * bold and italic. A description is two sentences under a shop's name; the
 * rest of Markdown is either meaningless there or actively unwanted, and
 * every construct added is another thing to escape correctly. Nothing here
 * produces HTML: the caller renders plain React nodes, so there is no route
 * from a seller's typing to markup on the page.
 */

export type TextRun = { text: string; bold?: boolean; italic?: boolean }

/**
 * Splits text into runs, honouring **bold** and *italic*.
 *
 * Bold is matched first, because `**a**` is otherwise two italic markers
 * around nothing. Unclosed markers are left exactly as typed — somebody
 * writing "2 * 3 * 4" means arithmetic, and a formatter that silently eats
 * their asterisks is worse than one that ignores them.
 */
export function formatRuns(input: string): TextRun[] {
  const runs: TextRun[] = []
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*/gs
  let index = 0

  for (const match of input.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > index) runs.push({ text: input.slice(index, at) })
    if (match[1] !== undefined) runs.push({ text: match[1], bold: true })
    else runs.push({ text: match[2], italic: true })
    index = at + match[0].length
  }

  if (index < input.length) runs.push({ text: input.slice(index) })
  return runs.filter((run) => run.text !== '')
}

/**
 * Blank lines are a paragraph break and single ones are a line break, which is
 * what everybody means by them. Runs of three or more collapse to one gap, so
 * nothing can be pushed off the screen with fifty returns.
 */
export function tidyBreaks(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
