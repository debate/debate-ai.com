"use server"


export async function shareSpeech(emails: string[], speechName: string, content: string) {
  // In a real app, this would use an email service like Resend, SendGrid, etc.
  console.log(`[Mock Email Service] Sharing speech "${speechName}" with:`, emails)
  console.log(`[Mock Email Service] Content preview: ${content.substring(0, 50)}...`)

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  return { success: true, message: `Shared with ${emails.length} participants` }
}
