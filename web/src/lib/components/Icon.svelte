<script lang="ts">
  import IconifyIcon from "@iconify/svelte";
  import arrowLeft from "@iconify-icons/lucide/arrow-left";
  import arrowRight from "@iconify-icons/lucide/arrow-right";
  import bookOpen from "@iconify-icons/lucide/book-open";
  import check from "@iconify-icons/lucide/check";
  import chevronDown from "@iconify-icons/lucide/chevron-down";
  import chevronRight from "@iconify-icons/lucide/chevron-right";
  import house from "@iconify-icons/lucide/house";
  import play from "@iconify-icons/lucide/play";
  import x from "@iconify-icons/lucide/x";

  type IconName =
    | "arrow-left"
    | "arrow-right"
    | "chevron-right"
    | "chevron-down"
    | "check"
    | "x"
    | "play"
    | "book"
    | "home";

  let {
    name,
    size = 16,
    className = "",
  }: { name: IconName; size?: number; className?: string } = $props();

  // Lucide ships a 2px stroke. The interface uses 1.5px everywhere.
  function withStroke<T extends { body: string }>(icon: T): T {
    return { ...icon, body: icon.body.replaceAll('stroke-width="2"', 'stroke-width="1.5"') };
  }

  const icons = {
    "arrow-left": withStroke(arrowLeft),
    "arrow-right": withStroke(arrowRight),
    "chevron-right": withStroke(chevronRight),
    "chevron-down": withStroke(chevronDown),
    check: withStroke(check),
    x: withStroke(x),
    play: withStroke(play),
    book: withStroke(bookOpen),
    home: withStroke(house),
  };
</script>

<IconifyIcon
  icon={icons[name]}
  width={size}
  height={size}
  class={className}
  aria-hidden="true"
/>
