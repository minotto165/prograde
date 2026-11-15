<script lang="ts">
  type IconName =
    | "arrow-left"
    | "arrow-right"
    | "chevron-right"
    | "chevron-down"
    | "check"
    | "x"
    | "play"
    | "terminal"
    | "book"
    | "flame"
    | "rotate"
    | "lightbulb"
    | "home"
    | "help"
    | "spark"
    | "clock";

  let {
    name,
    size = 18,
    className = "",
  }: { name: IconName; size?: number; className?: string } = $props();

  const paths: Record<IconName, string> = {
    "arrow-left": "M15 18l-6-6 6-6",
    "arrow-right": "M9 6l6 6-6 6",
    "chevron-right": "M9 18l6-6-6-6",
    "chevron-down": "M6 9l6 6 6-6",
    check: "M20 6L9 17l-5-5",
    x: "M18 6L6 18M6 6l12 12",
    play: "M9 6l9 6-9 6V6z",
    terminal: "M4 17l6-6-6-6M12 19h8",
    book: "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5z",
    flame:
      "M12 22c4 0 7-2.7 7-6.5 0-3.2-2.2-5.3-3.8-7.1C13.8 6.8 13 5 13 2c-2.5 1.8-4 4.5-4 6.7 0 1.4.5 2.5 1.2 3.4C8.6 11.3 7 9.4 7 7c-1.3 1.9-2 4.2-2 6.5C5 19.3 8 22 12 22z",
    rotate: "M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8M3 3v5h5",
    lightbulb: "M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z",
    home: "M3 11l9-8 9 8M5 10v10h14V10",
    help: "M9.1 9a3 3 0 015.8 1c0 2-3 2-3 4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z",
    clock: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  aria-hidden="true"
>
  <path d={paths[name]} />
</svg>
