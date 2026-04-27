#![forbid(unsafe_code)]

use std::process::ExitCode;

fn main() -> ExitCode {
    match repoanalyze::cli::run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            if let Some(scan_err) = e.downcast_ref::<repoanalyze::error::ScanError>() {
                let code = match scan_err {
                    repoanalyze::error::ScanError::InvalidArgs(_) => 2,
                    repoanalyze::error::ScanError::RepoOpen(_) => 3,
                    repoanalyze::error::ScanError::ScanFailed(_) => 4,
                    repoanalyze::error::ScanError::ReportFailed(_) => 5,
                    repoanalyze::error::ScanError::GitHubFailed(_) => 6,
                };
                eprintln!("Error: {scan_err}");
                ExitCode::from(code)
            } else {
                // clap errors (help, missing args) exit with code 2
                eprintln!("Error: {e}");
                ExitCode::from(2)
            }
        }
    }
}
