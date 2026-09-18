<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const isOpen = ref(false)
const title = ref('图表预览')
const scale = ref(1)
const fitScale = ref(1)
const sourceWidth = ref(1)
const sourceHeight = ref(1)
const viewport = ref<HTMLElement>()
const renderHost = ref<HTMLElement>()
const closeButton = ref<HTMLButtonElement>()

let observer: MutationObserver | undefined
let previousBodyOverflow = ''
let previousFocus: HTMLElement | null = null

const percentage = computed(() => `${Math.round(scale.value * 100)}%`)
const stageStyle = computed(() => ({
  width: `${Math.max(1, sourceWidth.value * scale.value)}px`,
  height: `${Math.max(1, sourceHeight.value * scale.value)}px`
}))

function getPreviewTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null

  const candidate = target.closest<HTMLElement>(
    '.vp-doc .mermaid, .vp-doc img.media-zoomable'
  )
  if (!candidate || candidate.classList.contains('no-zoom')) return null
  if (candidate instanceof HTMLImageElement && candidate.closest('.mermaid')) return null

  return candidate
}

function nearestHeading(element: HTMLElement): string {
  const headings = Array.from(
    document.querySelectorAll<HTMLElement>('.vp-doc h2, .vp-doc h3, .vp-doc h4')
  )
  const top = element.getBoundingClientRect().top + window.scrollY

  for (let index = headings.length - 1; index >= 0; index--) {
    const heading = headings[index]
    if (heading.getBoundingClientRect().top + window.scrollY < top) {
      return heading.textContent?.trim() || '图表预览'
    }
  }

  return '图表预览'
}

function svgDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.viewBox?.baseVal
  if (viewBox?.width && viewBox?.height) {
    return { width: viewBox.width, height: viewBox.height }
  }

  const rect = svg.getBoundingClientRect()
  return {
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height)
  }
}

function prepareSvg(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('width')
  clone.removeAttribute('height')
  clone.style.width = '100%'
  clone.style.height = '100%'
  clone.style.maxWidth = 'none'
  clone.style.display = 'block'
  clone.setAttribute('aria-hidden', 'true')
  return clone
}

async function openPreview(source: HTMLElement): Promise<void> {
  let node: HTMLElement | SVGSVGElement
  let dimensions: { width: number; height: number }

  if (source.classList.contains('mermaid')) {
    const svg = source.querySelector<SVGSVGElement>('svg')
    if (!svg) return

    dimensions = svgDimensions(svg)
    node = prepareSvg(svg)
    title.value = nearestHeading(source)
  } else if (source instanceof HTMLImageElement) {
    const image = document.createElement('img')
    image.src = source.currentSrc || source.src
    image.alt = source.alt
    image.decoding = 'async'
    image.draggable = false
    dimensions = {
      width: Math.max(1, source.naturalWidth || source.getBoundingClientRect().width),
      height: Math.max(1, source.naturalHeight || source.getBoundingClientRect().height)
    }
    node = image
    title.value = source.alt?.trim() || nearestHeading(source)
  } else {
    return
  }

  previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  sourceWidth.value = dimensions.width
  sourceHeight.value = dimensions.height
  isOpen.value = true

  await nextTick()
  if (!renderHost.value) return

  renderHost.value.replaceChildren(node)
  await nextTick()
  fitToWidth(false)
  closeButton.value?.focus()
}

function closePreview(): void {
  if (!isOpen.value) return
  isOpen.value = false
  document.body.style.overflow = previousBodyOverflow
  renderHost.value?.replaceChildren()
  previousFocus?.focus()
}

function setScale(nextScale: number, preserveCenter = true): void {
  const view = viewport.value
  const oldScale = scale.value
  const clamped = Math.min(4, Math.max(0.05, nextScale))
  if (Math.abs(clamped - oldScale) < 0.001) return

  let centerX = 0
  let centerY = 0
  if (view && preserveCenter) {
    centerX = view.scrollLeft + view.clientWidth / 2
    centerY = view.scrollTop + view.clientHeight / 2
  }

  scale.value = clamped
  nextTick(() => {
    if (!view || !preserveCenter) return
    const ratio = clamped / oldScale
    view.scrollLeft = centerX * ratio - view.clientWidth / 2
    view.scrollTop = centerY * ratio - view.clientHeight / 2
  })
}

function fitToWidth(preserveCenter = false): void {
  const view = viewport.value
  if (!view) return

  const availableWidth = Math.max(1, view.clientWidth - 48)
  fitScale.value = Math.min(1, availableWidth / sourceWidth.value)
  setScale(fitScale.value, preserveCenter)

  nextTick(() => {
    if (!preserveCenter && view) {
      view.scrollLeft = 0
      view.scrollTop = 0
    }
  })
}

function actualSize(): void {
  setScale(1)
}

function zoomIn(): void {
  setScale(scale.value * 1.25)
}

function zoomOut(): void {
  setScale(scale.value / 1.25)
}

function onWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  setScale(scale.value * (event.deltaY < 0 ? 1.12 : 1 / 1.12))
}

function annotateMedia(root: ParentNode = document): void {
  const media = root.querySelectorAll<HTMLElement>('.vp-doc .mermaid, .vp-doc img')
  media.forEach((element) => {
    if (element.classList.contains('no-zoom')) return
    if (element instanceof HTMLImageElement && element.closest('.mermaid')) return

    element.classList.add('media-zoomable')
    if (!element.hasAttribute('tabindex')) element.tabIndex = 0
    if (!element.hasAttribute('role')) element.setAttribute('role', 'button')
    if (!element.hasAttribute('aria-label')) {
      const label = element instanceof HTMLImageElement && element.alt
        ? `放大查看：${element.alt}`
        : `放大查看：${nearestHeading(element)}`
      element.setAttribute('aria-label', label)
    }
    if (!element.hasAttribute('title')) element.title = '点击放大查看'
  })
}

function onDocumentClick(event: MouseEvent): void {
  if (isOpen.value || event.button !== 0) return
  const source = getPreviewTarget(event.target)
  if (!source) return

  event.preventDefault()
  void openPreview(source)
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (!isOpen.value) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const source = getPreviewTarget(event.target)
    if (!source) return
    event.preventDefault()
    void openPreview(source)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closePreview()
  } else if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    zoomIn()
  } else if (event.key === '-') {
    event.preventDefault()
    zoomOut()
  } else if (event.key === '0') {
    event.preventDefault()
    fitToWidth()
  } else if (event.key === '1') {
    event.preventDefault()
    actualSize()
  }
}

function onWindowResize(): void {
  if (isOpen.value && Math.abs(scale.value - fitScale.value) < 0.01) {
    fitToWidth(false)
  }
}

onMounted(() => {
  annotateMedia()
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('resize', onWindowResize)

  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if (node.matches('.vp-doc .mermaid, .vp-doc img')) {
            annotateMedia(node.parentNode || document)
          } else {
            annotateMedia(node)
          }
        }
      })
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('resize', onWindowResize)
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <Teleport to="body">
    <Transition name="media-preview">
      <section
        v-if="isOpen"
        class="media-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-preview-title"
      >
        <header class="media-preview__toolbar">
          <div class="media-preview__heading">
            <strong id="media-preview-title">{{ title }}</strong>
            <span>{{ percentage }}</span>
          </div>
          <div class="media-preview__actions" aria-label="预览控制">
            <button type="button" title="缩小（-）" aria-label="缩小" @click="zoomOut">
              −
            </button>
            <button type="button" title="放大（+）" aria-label="放大" @click="zoomIn">
              ＋
            </button>
            <button type="button" title="适应宽度（0）" @click="fitToWidth()">
              适应宽度
            </button>
            <button type="button" title="原始尺寸（1）" @click="actualSize">
              100%
            </button>
            <button
              ref="closeButton"
              type="button"
              class="media-preview__close"
              title="关闭（Esc）"
              aria-label="关闭预览"
              @click="closePreview"
            >
              关闭
            </button>
          </div>
        </header>

        <div
          ref="viewport"
          class="media-preview__viewport"
          tabindex="0"
          aria-label="可滚动的图片预览区域"
          @wheel="onWheel"
        >
          <div class="media-preview__stage" :style="stageStyle">
            <div ref="renderHost" class="media-preview__content" />
          </div>
        </div>

        <p class="media-preview__help">
          使用 ＋/− 缩放，0 适应宽度，1 查看原始尺寸，Esc 关闭；放大后可滚动查看。
        </p>
      </section>
    </Transition>
  </Teleport>
</template>
