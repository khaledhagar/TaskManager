import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Attachment, Board, Card } from '../api/boards'
import { ApiError } from '../api/client'
import { files } from '../api/files'
import type { BoardActions } from '../board/useBoard'
import { AttachmentsSection } from './AttachmentsSection'
import { Backdrop } from './Backdrop'
import { BackgroundPicker } from './BackgroundPicker'
import { shrinkImage } from './uploads'

vi.mock('../api/files', () => ({
  files: {
    attach: vi.fn(),
    remove: vi.fn(),
    url: (id: number, inline = false) => `/api/attachments/${id}${inline ? '?inline=1' : ''}`,
    usage: vi.fn(),
    uploadBackground: vi.fn(),
    setPreset: vi.fn(),
    removeBackground: vi.fn(),
    backgroundUrl: (id: number, v: number) => `/api/boards/${id}/background?v=${v}`,
  },
}))
vi.mock('./uploads', async (original) => ({
  ...(await original<typeof import('./uploads')>()),
  shrinkImage: vi.fn(),
}))

const pdf: Attachment = {
  id: 5,
  filename: 'spec.pdf',
  content_type: 'application/pdf',
  size: 2048,
  is_image: false,
  created_at: '',
}
const photo: Attachment = { ...pdf, id: 6, filename: 'photo.png', content_type: 'image/png', is_image: true }
const card = (attachments: Attachment[] = []): Card => ({
  id: 1,
  title: 'Card',
  details: '',
  completed: false,
  priority: 'medium',
  due_date: null,
  position: 0,
  label_ids: [],
  checklist: [],
  attachments,
})

let actions: BoardActions
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(files.usage).mockResolvedValue({ used: 3 * 1024 * 1024, limit: 100 * 1024 * 1024 })
  actions = { attachmentAdded: vi.fn(), deleteAttachment: vi.fn() } as unknown as BoardActions
})

const fileOf = (name: string, size = 10, type = '') => new File([new Uint8Array(size)], name, { type })

describe('attachments (T-221, T-222)', () => {
  test('lists files with download links, image preview and storage use', async () => {
    render(<AttachmentsSection card={card([pdf, photo])} actions={actions} />)
    expect(screen.getByRole('link', { name: 'spec.pdf' })).toHaveAttribute('href', '/api/attachments/5')
    expect(screen.getByRole('link', { name: 'spec.pdf' })).toHaveAttribute('download', 'spec.pdf')
    expect(document.querySelector('img')).toHaveAttribute('src', '/api/attachments/6?inline=1')
    expect(await screen.findByText('3.0 MB of 100.0 MB used')).toBeInTheDocument()
  })

  test('uploads with progress and adds the file to the card', async () => {
    let finish!: (a: Attachment) => void
    vi.mocked(files.attach).mockImplementation((_card, _file, onProgress) => {
      onProgress?.(0.4)
      return new Promise((resolve) => (finish = resolve))
    })
    render(<AttachmentsSection card={card()} actions={actions} />)
    await userEvent.upload(screen.getByLabelText('Choose files'), fileOf('spec.pdf'))
    expect(screen.getByRole('progressbar', { name: 'Uploading spec.pdf' })).toHaveAttribute('aria-valuenow', '40')
    finish(pdf)
    await vi.waitFor(() => expect(actions.attachmentAdded).toHaveBeenCalledWith(1, pdf))
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  test('blocked or oversized files are refused before upload', async () => {
    render(<AttachmentsSection card={card()} actions={actions} />)
    const input = screen.getByLabelText('Choose files')
    await userEvent.upload(input, [fileOf('drawing.svg'), fileOf('big.pdf', 5 * 1024 * 1024)], {
      applyAccept: false,
    })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("drawing.svg: This file type isn't allowed")
    expect(alert).toHaveTextContent('big.pdf: This file is 5.0 MB. The limit is 4 MB.')
    expect(files.attach).not.toHaveBeenCalled()
  })

  test('a full card refuses more files', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...pdf, id: 100 + i, filename: `f${i}.pdf` }))
    render(<AttachmentsSection card={card(ten)} actions={actions} />)
    await userEvent.upload(screen.getByLabelText('Choose files'), fileOf('one-more.pdf'))
    expect(screen.getByRole('alert')).toHaveTextContent('up to 10 files')
    expect(files.attach).not.toHaveBeenCalled()
  })

  test('server errors are shown for that file', async () => {
    vi.mocked(files.attach).mockRejectedValue(new ApiError(400, 'Not enough storage left.'))
    render(<AttachmentsSection card={card()} actions={actions} />)
    await userEvent.upload(screen.getByLabelText('Choose files'), fileOf('spec.pdf'))
    expect(await screen.findByRole('alert')).toHaveTextContent('spec.pdf: Not enough storage left.')
  })

  test('delete asks first', async () => {
    render(<AttachmentsSection card={card([pdf])} actions={actions} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete spec.pdf' }))
    expect(actions.deleteAttachment).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Delete file' }))
    expect(actions.deleteAttachment).toHaveBeenCalledWith(1, 5)
  })
})

describe('background picker (T-223)', () => {
  const board = { id: 3, background: { kind: 'none', preset: null, version: 0 } } as unknown as Board

  test('presets apply at once', async () => {
    vi.mocked(files.setPreset).mockResolvedValue({ kind: 'preset', preset: 'dusk', version: 1 })
    const onChange = vi.fn()
    render(<BackgroundPicker open board={board} onClose={vi.fn()} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Dusk' }))
    expect(files.setPreset).toHaveBeenCalledWith(3, 'dusk')
    expect(onChange).toHaveBeenCalledWith({ kind: 'preset', preset: 'dusk', version: 1 })
  })

  test('a photo is shrunk in the browser, then uploaded', async () => {
    const small = new Blob(['webp'])
    vi.mocked(shrinkImage).mockResolvedValue(small)
    vi.mocked(files.uploadBackground).mockResolvedValue({ kind: 'image', preset: null, version: 2 })
    const onChange = vi.fn()
    render(<BackgroundPicker open board={board} onClose={vi.fn()} onChange={onChange} />)
    const photoFile = fileOf('trip.jpg', 100, 'image/jpeg')
    await userEvent.upload(screen.getByLabelText('Upload a photo'), photoFile)
    expect(shrinkImage).toHaveBeenCalledWith(photoFile)
    expect(files.uploadBackground).toHaveBeenCalledWith(3, small, expect.any(Function))
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ kind: 'image', preset: null, version: 2 }))
  })

  test('non-photos are refused before upload', async () => {
    render(<BackgroundPicker open board={board} onClose={vi.fn()} onChange={vi.fn()} />)
    await userEvent.upload(screen.getByLabelText('Upload a photo'), fileOf('anim.gif'), { applyAccept: false })
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPG, PNG or WebP photo.')
    expect(shrinkImage).not.toHaveBeenCalled()
  })

  test('remove background', async () => {
    vi.mocked(files.removeBackground).mockResolvedValue(undefined)
    const onChange = vi.fn()
    const withPreset = { ...board, background: { kind: 'preset', preset: 'navy', version: 4 } } as Board
    render(<BackgroundPicker open board={withPreset} onClose={vi.fn()} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Navy' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Remove background' }))
    expect(files.removeBackground).toHaveBeenCalledWith(3)
    expect(onChange).toHaveBeenCalledWith({ kind: 'none', preset: null, version: 5 })
  })
})

describe('backdrop keeps the board readable (T-224)', () => {
  test('photo backdrop has a dim layer and uses the versioned image', () => {
    const { container } = render(<Backdrop boardId={3} background={{ kind: 'image', preset: null, version: 7 }} />)
    const layer = container.firstElementChild as HTMLElement
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(layer.style.backgroundImage).toContain('/api/boards/3/background?v=7')
    expect(within(layer).getByTestId('dim')).toBeInTheDocument()
  })

  test('preset backdrop and none', () => {
    const { container, rerender } = render(
      <Backdrop boardId={3} background={{ kind: 'preset', preset: 'sky', version: 1 }} />,
    )
    expect(container.firstElementChild).toHaveAttribute('data-preset', 'sky')
    rerender(<Backdrop boardId={3} background={{ kind: 'none', preset: null, version: 1 }} />)
    expect(container.firstElementChild).toBeNull()
  })
})
