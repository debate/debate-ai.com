export const getYearShade = (year: string) => {
  const yearNum = Number.parseInt(year)
  if (yearNum >= 24) return "bg-yellow-500 text-yellow-950"
  if (yearNum >= 23) return "bg-yellow-400 text-yellow-900"
  if (yearNum >= 22) return "bg-yellow-300 text-yellow-800"
  if (yearNum >= 21) return "bg-yellow-200 text-yellow-700"
  if (yearNum >= 20) return "bg-yellow-100 text-yellow-600"
  return "bg-yellow-50 text-yellow-500"
}

export const extractAuthor = (citeShort: string) => {
  // Extract author name before year (e.g., "Chen & Rodriguez 2024" -> "Chen & Rodriguez")
  return citeShort.replace(/\s+\d{4}$/, "")
}

export const extractYear = (citeShort: string) => {
  // Extract 4-digit year from citation (e.g., "Chen & Rodriguez 2024" -> "2024")
  const match = citeShort.match(/\d{4}/)
  return match ? match[0] : ""
}

export const getBlueShade = (count: number) => {
  if (count >= 1000) return "bg-blue-600 text-white dark:bg-blue-600"
  if (count >= 500) return "bg-blue-500 text-white dark:bg-blue-500"
  if (count >= 250) return "bg-blue-400 text-white dark:bg-blue-400"
  if (count >= 100) return "bg-blue-300 text-blue-900 dark:bg-blue-300 dark:text-blue-900"
  if (count >= 50) return "bg-blue-200 text-blue-800 dark:bg-blue-200 dark:text-blue-800"
  return "bg-blue-100 text-blue-700 dark:bg-blue-100 dark:text-blue-700"
}

export const getGreenShade = (wordCount: number) => {
  if (wordCount >= 2500) return "bg-green-600 text-white dark:bg-green-600"
  if (wordCount >= 2000) return "bg-green-500 text-white dark:bg-green-500"
  if (wordCount >= 1500) return "bg-green-400 text-white dark:bg-green-400"
  if (wordCount >= 1000) return "bg-green-300 text-green-900 dark:bg-green-300 dark:text-green-900"
  if (wordCount >= 500) return "bg-green-200 text-green-800 dark:bg-green-200 dark:text-green-800"
  return "bg-green-100 text-green-700 dark:bg-green-100 dark:text-green-700"
}

export const htmlToText = (html: string): string => {
  return html
    .replace(/<mark>(.*?)<\/mark>/g, "$1")
    .replace(/<u>(.*?)<\/u>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim()
}
