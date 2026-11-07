"""
svg_studio.py - Deterministic 2D Vector & Geometry Studio for Concept Visuals.
Eliminates coordinate guesswork, guarantees crisp typography, provides smart
label collision avoidance, and generates publication-grade SVGs in sub-5ms.
"""

from pathlib import Path
from typing import Tuple, Optional, List, Dict, Any
import drawsvg as draw


class LabelManager:
    """
    Collision avoidance manager that tracks occupied 2D bounding boxes and
    determines the optimal non-overlapping position for text labels.
    """

    def __init__(self, padding: float = 3.0):
        self.boxes: List[Tuple[float, float, float, float]] = []
        self.padding = padding

    def register_box(self, x1: float, y1: float, x2: float, y2: float):
        """Register an occupied bounding box [x1, y1, x2, y2]."""
        self.boxes.append(
            (
                x1 - self.padding,
                y1 - self.padding,
                x2 + self.padding,
                y2 + self.padding,
            )
        )

    def overlaps(self, b: Tuple[float, float, float, float]) -> bool:
        """Check if box b intersects with any already-registered box."""
        for ob in self.boxes:
            # Overlap condition
            if not (b[2] < ob[0] or b[0] > ob[2] or b[3] < ob[1] or b[1] > ob[3]):
                return True
        return False

    def find_best_position(
        self,
        anchor_x: float,
        anchor_y: float,
        text_w: float,
        text_h: float,
        preferred_offset: Optional[Tuple[float, float]] = None,
    ) -> Tuple[float, float, str]:
        """
        Evaluate candidate label placements around anchor (x, y) and pick
        the first one that does not collide.
        """
        candidates = []
        if preferred_offset:
            candidates.append(
                (
                    "preferred",
                    anchor_x + preferred_offset[0],
                    anchor_y + preferred_offset[1],
                )
            )

        candidates.extend(
            [
                ("tr", anchor_x + 8, anchor_y - text_h - 2),
                ("tl", anchor_x - text_w - 8, anchor_y - text_h - 2),
                ("br", anchor_x + 8, anchor_y + 4),
                ("bl", anchor_x - text_w - 8, anchor_y + 4),
                ("top", anchor_x - text_w / 2, anchor_y - text_h - 8),
                ("bottom", anchor_x - text_w / 2, anchor_y + 8),
                ("tr_far", anchor_x + 14, anchor_y - text_h - 8),
                ("tl_far", anchor_x - text_w - 14, anchor_y - text_h - 8),
            ]
        )

        for name, cx, cy in candidates:
            candidate_box = (cx, cy, cx + text_w, cy + text_h)
            if not self.overlaps(candidate_box):
                self.register_box(*candidate_box)
                return cx, cy, name

        # Fallback to the first candidate if all collide
        fb_x, fb_y = candidates[0][1], candidates[0][2]
        self.register_box(fb_x, fb_y, fb_x + text_w, fb_y + text_h)
        return fb_x, fb_y, candidates[0][0]


class StudioCanvas:
    """
    A deterministic 2D canvas that maps mathematical data coordinates (x, y)
    to SVG pixel coordinates (px, py) with zero guesswork and theme support.
    """

    THEMES = {
        "dark": {
            "bg": "#07090e",
            "panel": "#0f172a",
            "border": "#1e293b",
            "grid": "#151d2a",
            "axis": "#475569",
            "text": "#f8fafc",
            "text_muted": "#94a3b8",
            "pill_bg": "rgba(15, 23, 42, 0.88)",
            "pill_border": "rgba(51, 65, 85, 0.65)",
            "pos_fill": "rgba(16, 185, 129, 0.18)",
            "pos_stroke": "#10b981",
            "neg_fill": "rgba(244, 63, 94, 0.18)",
            "neg_stroke": "#f43f5e",
        },
        "light": {
            "bg": "#f8fafc",
            "panel": "#ffffff",
            "border": "#cbd5e1",
            "grid": "#f1f5f9",
            "axis": "#94a3b8",
            "text": "#0f172a",
            "text_muted": "#64748b",
            "pill_bg": "rgba(255, 255, 255, 0.92)",
            "pill_border": "rgba(203, 213, 225, 0.85)",
            "pos_fill": "rgba(16, 185, 129, 0.14)",
            "pos_stroke": "#059669",
            "neg_fill": "rgba(244, 63, 94, 0.14)",
            "neg_stroke": "#e11d48",
        },
    }

    FONT_FAMILY = (
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    )

    def __init__(
        self,
        width: int = 740,
        height: int = 380,
        x_range: Tuple[float, float] = (-5.0, 5.0),
        y_range: Tuple[float, float] = (-5.0, 5.0),
        padding: int = 36,
        theme: str = "dark",
        title: Optional[str] = None,
        plot_width: Optional[int] = None,
    ):
        self.width = width
        self.height = height
        self.x_min, self.x_max = x_range
        self.y_min, self.y_max = y_range
        self.padding = padding
        self.theme_name = theme
        self.palette = self.THEMES.get(theme, self.THEMES["dark"])

        # Usable drawing bounds inside padding (supports custom plot_width for sidebars)
        total_plot_w = plot_width if plot_width else (width - 2 * padding)
        self.plot_w = total_plot_w
        self.plot_h = height - 2 * padding

        self.labels = LabelManager()
        self.d = draw.Drawing(width, height)

        # Outer card with rounded corners and border
        self.d.append(
            draw.Rectangle(
                0,
                0,
                width,
                height,
                fill=self.palette["bg"],
                stroke=self.palette["border"],
                stroke_width=1,
                rx=8,
            )
        )

        # Markers
        self._markers: Dict[str, Any] = {}
        self._register_marker("cyan", "#38bdf8")
        self._register_marker("emerald", "#10b981")
        self._register_marker("rose", "#f43f5e")
        self._register_marker("purple", "#a855f7")
        self._register_marker("slate", self.palette["axis"])

        if title:
            self.d.append(
                draw.Text(
                    title,
                    12,
                    16,
                    22,
                    fill=self.palette["text"],
                    font_family=self.FONT_FAMILY,
                    font_weight="700",
                    letter_spacing="0.02em",
                )
            )
            # Register title box
            self.labels.register_box(16, 10, 16 + len(title) * 7.5, 26)

    def _register_marker(self, name: str, color: str):
        marker = draw.Marker(-0.1, -0.5, 0.9, 0.5, scale=4, orient="auto")
        marker.append(
            draw.Lines(-0.1, -0.5, -0.1, 0.5, 0.9, 0, fill=color, close=True)
        )
        self.d.append(marker)
        self._markers[name] = marker

    def to_px(self, x: float, y: float) -> Tuple[float, float]:
        """Convert mathematical coordinates (x, y) to SVG pixel coordinates (px, py)."""
        px = self.padding + (
            (x - self.x_min) / (self.x_max - self.x_min)
        ) * self.plot_w
        py = (
            self.height
            - self.padding
            - ((y - self.y_min) / (self.y_max - self.y_min)) * self.plot_h
        )
        return px, py

    def draw_grid(self, step: float = 1.0):
        """Draw clean, non-distracting background grid lines."""
        x_start = int(self.x_min // step * step)
        x_end = int(self.x_max // step * step)
        for x in range(x_start, x_end + 1):
            px, _ = self.to_px(x, 0)
            self.d.append(
                draw.Line(
                    px,
                    self.padding,
                    px,
                    self.height - self.padding,
                    stroke=self.palette["grid"],
                    stroke_width=1,
                )
            )

        y_start = int(self.y_min // step * step)
        y_end = int(self.y_max // step * step)
        for y in range(y_start, y_end + 1):
            _, py = self.to_px(0, y)
            self.d.append(
                draw.Line(
                    self.padding,
                    py,
                    self.padding + self.plot_w,
                    py,
                    stroke=self.palette["grid"],
                    stroke_width=1,
                )
            )

    def draw_axes(
        self,
        center_x: float = 0.0,
        center_y: float = 0.0,
        labels: Tuple[str, str] = ("X", "Y"),
        dashed: bool = True,
        origin_label: Optional[str] = "0",
    ):
        """Draw clean crosshair axes with arrows and labels."""
        cx_px, cy_px = self.to_px(center_x, center_y)
        dash_style = {"stroke_dasharray": "4,4"} if dashed else {}

        # Horizontal axis
        self.d.append(
            draw.Line(
                self.padding,
                cy_px,
                self.padding + self.plot_w + 14,
                cy_px,
                stroke=self.palette["axis"],
                stroke_width=1.5,
                marker_end=self._markers["slate"],
                **dash_style,
            )
        )
        self.d.append(
            draw.Text(
                labels[0],
                11,
                self.padding + self.plot_w + 18,
                cy_px + 4,
                fill=self.palette["text_muted"],
                font_family=self.FONT_FAMILY,
                font_weight="600",
            )
        )

        # Vertical axis
        self.d.append(
            draw.Line(
                cx_px,
                self.height - self.padding,
                cx_px,
                self.padding - 14,
                stroke=self.palette["axis"],
                stroke_width=1.5,
                marker_end=self._markers["slate"],
                **dash_style,
            )
        )
        self.d.append(
            draw.Text(
                labels[1],
                11,
                cx_px,
                self.padding - 18,
                fill=self.palette["text_muted"],
                font_family=self.FONT_FAMILY,
                font_weight="600",
                text_anchor="middle",
            )
        )

        if origin_label:
            self.draw_pill_label(
                cx_px + 6,
                cy_px + 8,
                origin_label,
                font_size=9.5,
                text_color=self.palette["text_muted"],
            )

    def draw_pill_label(
        self,
        x: float,
        y: float,
        text: str,
        font_size: float = 10.5,
        text_color: Optional[str] = None,
        font_weight: str = "600",
        bg: Optional[str] = None,
        border: Optional[str] = None,
    ):
        """Draw a text string encased in a frosted pill backdrop to eliminate collisions."""
        text_color = text_color or self.palette["text"]
        bg = bg or self.palette["pill_bg"]
        border = border or self.palette["pill_border"]

        # Approximate text dimensions
        tw = len(text) * (font_size * 0.58) + 8
        th = font_size + 6

        # Draw rounded pill backdrop
        self.d.append(
            draw.Rectangle(
                x - 4,
                y - th + 4,
                tw,
                th,
                fill=bg,
                stroke=border,
                stroke_width=0.8,
                rx=3,
            )
        )
        self.d.append(
            draw.Text(
                text,
                font_size,
                x,
                y,
                fill=text_color,
                font_family=self.FONT_FAMILY,
                font_weight=font_weight,
            )
        )
        self.labels.register_box(x - 4, y - th + 4, x - 4 + tw, y + 4)

    def draw_point(
        self,
        x: float,
        y: float,
        color: str = "#10b981",
        radius: float = 4.5,
        label: Optional[str] = None,
        preferred_offset: Optional[Tuple[float, float]] = None,
    ):
        """Draw point with automatic collision-free label positioning."""
        px, py = self.to_px(x, y)
        self.d.append(
            draw.Circle(
                px,
                py,
                radius,
                fill=color,
                stroke="#ffffff",
                stroke_width=1.5,
            )
        )
        # Register point as an obstacle
        self.labels.register_box(
            px - radius, py - radius, px + radius, py + radius
        )

        if label:
            font_size = 10.5
            tw = len(label) * (font_size * 0.58) + 8
            th = font_size + 6
            lx, ly, _ = self.labels.find_best_position(
                px, py, tw, th, preferred_offset=preferred_offset
            )
            self.draw_pill_label(lx + 4, ly + th - 4, label, font_size=font_size)

    def draw_vector(
        self,
        x0: float,
        y0: float,
        x1: float,
        y1: float,
        color: str = "#38bdf8",
        marker: str = "cyan",
        stroke_width: float = 2.5,
        label: Optional[str] = None,
    ):
        """Draw directed vector with arrow marker."""
        p0x, p0y = self.to_px(x0, y0)
        p1x, p1y = self.to_px(x1, y1)

        marker_obj = self._markers.get(marker, self._markers["cyan"])
        self.d.append(
            draw.Line(
                p0x,
                p0y,
                p1x,
                p1y,
                stroke=color,
                stroke_width=stroke_width,
                marker_end=marker_obj,
            )
        )
        if label:
            font_size = 11
            tw = len(label) * (font_size * 0.58) + 8
            th = font_size + 6
            lx, ly, _ = self.labels.find_best_position(p1x, p1y, tw, th)
            self.draw_pill_label(
                lx + 4,
                ly + th - 4,
                label,
                font_size=font_size,
                text_color=color,
                font_weight="700",
            )

    def draw_dashed_line(
        self,
        x0: float,
        y0: float,
        x1: float,
        y1: float,
        color: Optional[str] = None,
        stroke_width: float = 1.5,
        dash: str = "4,4",
        label: Optional[str] = None,
    ):
        """Draw dashed line with optional pill label at the midpoint."""
        color = color or self.palette["text_muted"]
        p0x, p0y = self.to_px(x0, y0)
        p1x, p1y = self.to_px(x1, y1)
        self.d.append(
            draw.Line(
                p0x,
                p0y,
                p1x,
                p1y,
                stroke=color,
                stroke_width=stroke_width,
                stroke_dasharray=dash,
            )
        )
        if label:
            mx = (p0x + p1x) / 2
            my = (p0y + p1y) / 2
            font_size = 10.5
            tw = len(label) * (font_size * 0.58) + 8
            th = font_size + 6
            lx, ly, _ = self.labels.find_best_position(mx, my, tw, th)
            self.draw_pill_label(
                lx + 4,
                ly + th - 4,
                label,
                font_size=font_size,
                text_color=color,
                font_weight="600",
            )

    def draw_signed_rect(
        self,
        mean_x: float,
        mean_y: float,
        x: float,
        y: float,
    ):
        """
        Draw signed rectangle between mean and point (x, y) for Covariance.
        Green for positive (Q1, Q3), Red for negative (Q2, Q4).
        """
        p_mean_x, p_mean_y = self.to_px(mean_x, mean_y)
        p_x, p_y = self.to_px(x, y)

        dx = x - mean_x
        dy = y - mean_y
        area = dx * dy

        is_pos = area >= 0
        fill_col = (
            self.palette["pos_fill"] if is_pos else self.palette["neg_fill"]
        )
        stroke_col = (
            self.palette["pos_stroke"] if is_pos else self.palette["neg_stroke"]
        )

        rx = min(p_mean_x, p_x)
        ry = min(p_mean_y, p_y)
        rw = abs(p_x - p_mean_x)
        rh = abs(p_y - p_mean_y)

        self.d.append(
            draw.Rectangle(
                rx,
                ry,
                rw,
                rh,
                fill=fill_col,
                stroke=stroke_col,
                stroke_width=1.0,
                stroke_dasharray="2,2",
            )
        )

    def add_sidebar_panel(
        self,
        x: int,
        y: int,
        w: int,
        h: int,
        title: str,
        items: List[Dict[str, str]],
        summary_badge: Optional[Dict[str, str]] = None,
    ):
        """Render a publication sidebar table with zero-overlap metrics."""
        self.d.append(
            draw.Rectangle(
                x,
                y,
                w,
                h,
                fill=self.palette["panel"],
                stroke=self.palette["border"],
                stroke_width=1,
                rx=6,
            )
        )
        # Title
        self.d.append(
            draw.Text(
                title,
                11,
                x + 12,
                y + 20,
                fill=self.palette["text"],
                font_family=self.FONT_FAMILY,
                font_weight="700",
                letter_spacing="0.03em",
            )
        )
        # Separator
        self.d.append(
            draw.Line(
                x + 10,
                y + 28,
                x + w - 10,
                y + 28,
                stroke=self.palette["border"],
                stroke_width=1,
            )
        )

        curr_y = y + 46
        for it in items:
            label = it.get("label", "")
            val = it.get("value", "")
            val_col = it.get("color", self.palette["text"])

            self.d.append(
                draw.Text(
                    label,
                    10,
                    x + 12,
                    curr_y,
                    fill=self.palette["text_muted"],
                    font_family=self.FONT_FAMILY,
                )
            )
            self.d.append(
                draw.Text(
                    val,
                    10.5,
                    x + w - 12,
                    curr_y,
                    fill=val_col,
                    font_family=self.FONT_FAMILY,
                    font_weight="600",
                    text_anchor="end",
                )
            )
            curr_y += 22

        if summary_badge:
            b_text = summary_badge.get("text", "")
            b_kind = summary_badge.get("kind", "pos")
            b_col = "#10b981" if b_kind == "pos" else "#f43f5e"
            b_bg = (
                "rgba(16, 185, 129, 0.16)"
                if b_kind == "pos"
                else "rgba(244, 63, 94, 0.16)"
            )

            self.d.append(
                draw.Rectangle(
                    x + 10,
                    curr_y + 6,
                    w - 20,
                    28,
                    fill=b_bg,
                    stroke=b_col,
                    stroke_width=1,
                    rx=4,
                )
            )
            self.d.append(
                draw.Text(
                    b_text,
                    10.5,
                    x + w / 2,
                    curr_y + 23,
                    fill=b_col,
                    font_family=self.FONT_FAMILY,
                    font_weight="700",
                    text_anchor="middle",
                )
            )

    def save(
        self,
        svg_path: str,
        generate_html_viewer: bool = True,
    ) -> Path:
        """Saves SVG and companion HTML viewer for instant <agent-embed>."""
        path = Path(svg_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.d.save_svg(str(path))

        if generate_html_viewer:
            html_path = path.with_suffix(".html")
            svg_content = path.read_text(encoding="utf-8")
            html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: transparent;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }}
    .svg-container {{
      width: 100%;
      max-width: {self.width}px;
      display: flex;
      justify-content: center;
    }}
    svg {{
      width: 100%;
      height: auto;
      display: block;
      border-radius: 8px;
    }}
  </style>
</head>
<body>
  <div class="svg-container">
    {svg_content}
  </div>
</body>
</html>"""
            html_path.write_text(html_content, encoding="utf-8")

        return path
