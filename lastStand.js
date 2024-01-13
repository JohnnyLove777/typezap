const pm2 = require('pm2');

pm2.connect(err => {
    if (err) {
        console.error(err);
        process.exit(2);
    }

    console.log('PM2 conectado, monitorando typeListener...');

    // Monitora os logs do processo 'typeListener'
    pm2.launchBus((err, bus) => {
        if (err) {
            console.error(err);
            process.exit(2);
        }

        bus.on('log:err', data => {
            if (data.process.name === 'typeListener') {
                console.log('Erro detectado no typeListener, tentando reiniciar...');
                restartTypeListener();
            }
        });
    });
});

function restartTypeListener() {
    pm2.restart('typeListener', err => {
        if (err) {
            console.error('Erro ao reiniciar typeListener:', err);
        } else {
            console.log('typeListener reiniciado com sucesso.');
        }
    });
}
