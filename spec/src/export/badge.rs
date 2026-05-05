//! SVG badge generation — flat, flat-square, and pill styles.

use crate::scoring::ScoreResult;

/// Generate an SVG badge for the report card.
pub fn export_badge(score: &ScoreResult, style: &str, label: &str) -> String {
    let label = if label.is_empty() { "repo health" } else { label };
    let grade = &score.grade;
    let score_val = score.overall_score;
    let color = grade_color(grade);

    match style {
        "flat-square" => flat_square_badge(label, grade, score_val, color),
        "pill" => pill_badge(label, grade, score_val, color),
        _ => flat_badge(label, grade, score_val, color),
    }
}

fn grade_color(grade: &str) -> &'static str {
    match grade {
        "A" => "#22c55e",
        "B" => "#84cc16",
        "C" => "#eab308",
        "D" => "#f97316",
        _ => "#ef4444",
    }
}

fn flat_badge(label: &str, grade: &str, score: u32, color: &str) -> String {
    let label_width = label.len() as u32 * 7 + 12;
    let value_text = format!("{grade} ({score})");
    let value_width = value_text.len() as u32 * 7 + 12;
    let total_width = label_width + value_width;

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="20" role="img" aria-label="{label}: {grade} ({score})">
  <title>{label}: {grade} ({score})</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="{total_width}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="{label_width}" height="20" fill="#555"/>
    <rect x="{label_width}" width="{value_width}" height="20" fill="{color}"/>
    <rect width="{total_width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="{label_x}" y="15" fill="#010101" fill-opacity=".3">{label}</text>
    <text x="{label_x}" y="14">{label}</text>
    <text x="{value_x}" y="15" fill="#010101" fill-opacity=".3">{value_text}</text>
    <text x="{value_x}" y="14">{value_text}</text>
  </g>
</svg>"##,
        label_x = label_width / 2,
        value_x = label_width + value_width / 2,
    )
}

fn flat_square_badge(label: &str, grade: &str, score: u32, color: &str) -> String {
    let label_width = label.len() as u32 * 7 + 12;
    let value_text = format!("{grade} ({score})");
    let value_width = value_text.len() as u32 * 7 + 12;
    let total_width = label_width + value_width;

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="20" role="img" aria-label="{label}: {grade} ({score})">
  <title>{label}: {grade} ({score})</title>
  <g shape-rendering="crispEdges">
    <rect width="{label_width}" height="20" fill="#555"/>
    <rect x="{label_width}" width="{value_width}" height="20" fill="{color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="{label_x}" y="14">{label}</text>
    <text x="{value_x}" y="14">{value_text}</text>
  </g>
</svg>"##,
        label_x = label_width / 2,
        value_x = label_width + value_width / 2,
    )
}

fn pill_badge(label: &str, grade: &str, score: u32, color: &str) -> String {
    let label_width = label.len() as u32 * 7 + 16;
    let value_text = format!("{grade} ({score})");
    let value_width = value_text.len() as u32 * 7 + 16;
    let total_width = label_width + value_width;

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="24" role="img" aria-label="{label}: {grade} ({score})">
  <title>{label}: {grade} ({score})</title>
  <clipPath id="r">
    <rect width="{total_width}" height="24" rx="12" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="{label_width}" height="24" fill="#555"/>
    <rect x="{label_width}" width="{value_width}" height="24" fill="{color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="{label_x}" y="16">{label}</text>
    <text x="{value_x}" y="16">{value_text}</text>
  </g>
</svg>"##,
        label_x = label_width / 2,
        value_x = label_width + value_width / 2,
    )
}
