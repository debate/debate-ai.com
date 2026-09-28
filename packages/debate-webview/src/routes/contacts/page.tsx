import { ContactsHub } from "../../components/contacts/ContactsHub"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function ContactsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/contacts" backHref="/reason-editor" backLabel="the editor" guide="training-tools" />
      <ContactsHub />
    </ToolPage>
  )
}
