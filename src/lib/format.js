export function formatDate(date) {
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  if (typeof date === "string") {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      const day = parseInt(match[3], 10);
      const monthIndex = parseInt(match[2], 10) - 1;
      const year = match[1];
      return `${day} ${months[monthIndex]} ${year}`;
    }
    const d = new Date(date);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    return date.slice(0, 10);
  }
  return String(date);
}

export function dateValue(date) {
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  if (typeof date === "string") {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
    }
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

