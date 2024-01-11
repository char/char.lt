use std::{net::SocketAddr, path::PathBuf, sync::Arc};

use anyhow::{Context, Result};
use axum::{
    extract::{Path, State},
    response::{IntoResponse, Redirect, Response},
    routing::get,
    Router,
};
use clap::Parser;
use hyper::StatusCode;
use sqlx::SqlitePool;
use tokio::net::TcpListener;

#[cfg(unix)]
mod axum_unix;

#[derive(Parser, Debug)]
struct CLIArgs {
    #[arg(long, env = "BIND_ADDRESS", default_value = "127.0.0.1:3001")]
    bind_address: SocketAddr,
    #[arg(long, env = "BIND_UNIX")]
    bind_unix: Option<PathBuf>,
}

#[derive(Debug)]
struct AppState {
    db: SqlitePool,
}

async fn redirect(
    Path(path): Path<String>,
    State(app_state): State<Arc<AppState>>,
) -> Result<Response, Response> {
    let query = sqlx::query!("SELECT target_location FROM redirects WHERE path = ?", path);
    let record = query.fetch_optional(&app_state.db).await.map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, "Internal database error").into_response()
    })?;

    Ok(match record {
        Some(redirect) => Redirect::to(&redirect.target_location).into_response(),
        None => (StatusCode::NOT_FOUND, "No redirect exists.").into_response(),
    })
}

#[tokio::main]
async fn main() -> Result<()> {
    // TODO: listen to the thing
    let _ = dotenvy::from_filename_override(".env");
    let _ = dotenvy::from_filename_override(".env.local");

    let args = CLIArgs::parse();
    let database_url = std::env::var("DATABASE_URL")
        .context("Failed to read environment variable DATABASE_URL")?;
    // TODO: auth for putting shorten links and stuff

    let database =
        SqlitePool::connect_lazy(&database_url).context("Failed to connect to database")?;

    let state = Arc::new(AppState { db: database });

    let router: Router = Router::new().route("/*id", get(redirect)).with_state(state);

    if let Some(bind_unix) = args.bind_unix {
        #[cfg(unix)]
        {
            axum_unix::serve_unix(router, bind_unix).await?;
        }

        #[cfg(not(unix))]
        {
            let _ = bind_unix;
            anyhow::bail!("unix socket listening is not supported outside of unix!");
        }
    } else {
        let listener = TcpListener::bind(&args.bind_address)
            .await
            .context(format!("Failed to bind to {}", &args.bind_address))?;

        println!("Listening on http://{} ...", &args.bind_address);
        let _ = axum::serve(listener, router.into_make_service()).await;
    }

    Ok(())
}
