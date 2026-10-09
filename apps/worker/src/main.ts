const HEARTBEAT_INTERVAL_MS = 60_000;

function log(message: string) {
  console.log(`[petflow-worker] ${new Date().toISOString()} ${message}`);
}

function main() {
  log("worker iniciado (sem tarefas registradas nesta etapa)");
  log("próximas etapas poderão registrar agendamentos e processos em segundo plano");

  const heartbeat = setInterval(() => {
    log("heartbeat");
  }, HEARTBEAT_INTERVAL_MS);

  const shutdown = (signal: string) => {
    log(`sinal ${signal} recebido, encerrando`);
    clearInterval(heartbeat);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
