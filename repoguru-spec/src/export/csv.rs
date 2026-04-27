//! CSV export — per-category scores and signals.

use crate::scoring::ScoreResult;

pub fn export_csv(score: &ScoreResult) -> String {
    let mut out = String::new();

    // Header
    out.push_str("category,label,score,grade,weight\n");

    // Category rows
    for cat in &score.categories {
        out.push_str(&format!(
            "{},{},{},{},{:.2}\n",
            cat.key, cat.label, cat.score, cat.grade, cat.weight
        ));
    }

    // Overall row
    out.push_str(&format!(
        "overall,Overall,{},{},1.00\n",
        score.overall_score, score.grade
    ));

    // Blank line then signals
    out.push_str("\ncategory,signal,found,points,details\n");
    for cat in &score.categories {
        for sig in &cat.signals {
            let details_escaped = sig.details.replace(',', ";").replace('\n', " ");
            out.push_str(&format!(
                "{},{},{},{},{}\n",
                cat.key, sig.name, sig.found, sig.points, details_escaped
            ));
        }
    }

    out
}
