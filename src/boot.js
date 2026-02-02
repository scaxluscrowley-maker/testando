// Boot loader: importa o jogo e marca como iniciado.
import("./game.js")
  .then(() => { window.__MC_BOOTED = true; })
  .catch((err) => {
    console.error(err);
    // rethrow para o handler global capturar como unhandledrejection
    throw err;
  });
