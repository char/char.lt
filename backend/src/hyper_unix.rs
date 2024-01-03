use futures::ready;
use hyper::server::accept::Accept;
use std::{
    pin::Pin,
    task::{Context, Poll},
};
use tokio::net::{UnixListener, UnixStream};

pub struct UnixServerAccept {
    pub uds: UnixListener,
}

impl Accept for UnixServerAccept {
    type Conn = UnixStream;
    type Error = Box<dyn std::error::Error + Send + Sync>;

    fn poll_accept(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<Result<Self::Conn, Self::Error>>> {
        let (stream, _addr) = ready!(self.uds.poll_accept(cx))?;
        Poll::Ready(Some(Ok(stream)))
    }
}
