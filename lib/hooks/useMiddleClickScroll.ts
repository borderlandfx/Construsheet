import { useEffect, useRef } from 'react'

export function useMiddleClickScroll() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let isScrolling = false
    let startX = 0
    let startY = 0
    let scrollLeft = 0
    let scrollTop = 0
    let animationFrame: number

    const onMouseDown = (e: MouseEvent) => {
      // Middle mouse button = button 1
      if (e.button !== 1) return
      e.preventDefault()
      isScrolling = true
      startX = e.clientX
      startY = e.clientY
      scrollLeft = el.scrollLeft
      scrollTop = el.scrollTop
      el.style.cursor = 'grabbing'
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isScrolling) return
      e.preventDefault()

      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        el.scrollLeft = scrollLeft - dx
        el.scrollTop = scrollTop - dy
      })
    }

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 1) return
      isScrolling = false
      el.style.cursor = ''
    }

    const onContextMenu = (e: MouseEvent) => {
      if (isScrolling) e.preventDefault()
    }

    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    el.addEventListener('contextmenu', onContextMenu)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('contextmenu', onContextMenu)
      cancelAnimationFrame(animationFrame)
    }
  }, [])

  return ref
}
