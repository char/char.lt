use std::path::PathBuf;

use anyhow::{Context, Result};
use axum::Router;
use hyper::{body::Incoming, Request};
use hyper_util::{
    rt::{TokioExecutor, TokioIo},
    server::conn::auto::Builder as ConnectionBuilder,
};
use tokio::{net::UnixListener, select, signal::ctrl_c};
use tower::Service;

async fn listen_unix(router: Router, socket_path: PathBuf) -> Result<()> {
    let socket_path_display = socket_path.display();
    println!("Listening at (unix) {socket_path_display} ...");

    let mut make_service = router.into_make_service();
    let unix_socket = UnixListener::bind(&socket_path).context("Failed to bind to unix socket")?;
    loop {
        let Ok((stream, _)) = unix_socket.accept().await else { break };
        let tower_service = make_service.call(&stream).await?;
        tokio::spawn(async move {
            let tokio_socket = TokioIo::new(stream);
            let hyper_service = hyper::service::service_fn(move |req: Request<Incoming>| {
                tower_service.clone().call(req)
            });

            let _ = ConnectionBuilder::new(TokioExecutor::new())
                .serve_connection_with_upgrades(tokio_socket, hyper_service)
                .await;
        });
    }

    let _ = tokio::fs::remove_file(&socket_path).await;
    Ok(())
}

pub async fn serve_unix(router: Router, bind_unix: PathBuf) -> Result<()> {
    select! {
        _ = listen_unix(router, bind_unix) => {}
        _ = ctrl_c() => {}
    }

    Ok(())
}
