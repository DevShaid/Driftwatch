export const metadata = { title: 'DriftWatch', description: 'Terraform state drift detection for DevOps teams' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
