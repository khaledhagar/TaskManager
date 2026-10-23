# Opens each .docx in Microsoft Word, fills the table of contents and page numbers, saves it,
# and writes a PDF next to it for checking. Usage: pwsh update_fields.ps1 ..\README.docx
param([Parameter(Mandatory, ValueFromRemainingArguments)][string[]]$Files)
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    foreach ($file in $Files) {
        $path = (Resolve-Path $file).Path
        $doc = $word.Documents.Open($path)
        foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
        $doc.Fields.Update() | Out-Null
        $doc.Save()
        $doc.ExportAsFixedFormat([IO.Path]::ChangeExtension($path, '.pdf'), 17)
        $doc.Close()
        "updated $path"
    }
} finally {
    $word.Quit()
}
