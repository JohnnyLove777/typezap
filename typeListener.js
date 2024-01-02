const fs = require('fs');
const axios = require('axios');
const fetch = require('node-fetch');
const qrcode = require('qrcode-terminal');
const { Client, Buttons, List, MessageMedia, LocalAuth } = require('whatsapp-web.js');
require('dotenv').config();

// Listener para pegar Erro no Server e Restartar
const exec = require('child_process').exec;
const EventEmitter = require('events');
class MyEmitter extends EventEmitter {}
const myEmitter = new MyEmitter();

myEmitter.on('errorEvent', (error) => {
    console.log('Erro detectado, tentando reiniciar o serviço:', error);

    // Executar o comando para reiniciar o processo
    exec('pm2 restart sendMessage', (err, stdout, stderr) => {
        if (err) {
            console.error('Erro ao tentar reiniciar o serviço:', err);
            return;
        }
        console.log('Saída do comando de reinicialização:', stdout);
    });
});

let restartAPI = false;
// Fim do Listener do Erro do Server

const url_registro = process.env.url_registro; //URL de registro da api de chat Typebot; Exemplo: https://typebot-seutype.vm.elestio.app/api/v1/typebots/seufunil/startChat
const url_chat = process.env.url_chat; //URL de chat da api de chat Typebot; Exemplo: https://typebot-seutype.vm.elestio.app/api/v1/sessions/
const DATABASE_FILE = process.env.database_file1; //Arquivo JSON para guardar os registros dos usuários; Exemplo: seubanco.json
const gatilho = process.env.gatilho; //Gatilho para ativar o seu fluxo, escreva "null" caso queira um fluxo ativado com qualquer coisa
const sessao = "typeListener";

console.log("Bem-vindo ao sistema Johnny Love API 1.1 - A Integração Typebot + Whatsapp!");
console.log(`URL que inicia a sessão: ${url_registro}`);
console.log(`URL que entrega o chat: ${url_chat}`);
console.log(`Arquivo JSON das sessões: ${DATABASE_FILE}`);
console.log(`Nome da sessão: ${sessao}`);

// Configurações para o primeiro cliente (Windows)
/*const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessao }),
    puppeteer: {
      executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    }
  });*/
  
  //Kit com os comandos otimizados para nuvem Ubuntu Linux (créditos Pedrinho da Nasa Comunidade ZDG)
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessao }),
    puppeteer: {
      headless: true,
      //CAMINHO DO CHROME PARA WINDOWS (REMOVER O COMENTÁRIO ABAIXO)
      //executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      //===================================================================================
      // CAMINHO DO CHROME PARA MAC (REMOVER O COMENTÁRIO ABAIXO)
      //executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      //===================================================================================
      // CAMINHO DO CHROME PARA LINUX (REMOVER O COMENTÁRIO ABAIXO)
       executablePath: '/usr/bin/google-chrome-stable',
      //===================================================================================
      args: [
        '--no-sandbox', //Necessário para sistemas Linux
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- Este não funciona no Windows, apague caso suba numa máquina Windows
        '--disable-gpu'
      ]
    }
  });
  
// entao habilitamos o usuario a acessar o serviço de leitura do qr code
client.on('qr', qr => {
  qrcode.generate(qr, {small: true});
});

// apos isso ele diz que foi tudo certin
client.on('ready', () => {
  console.log('Listener Typebot e Wpp pronto e conectado.');
});

client.initialize();

//Rotinas da gestão de dados

function readJSONFile(nomeArquivo) {
  if (fs.existsSync(nomeArquivo)) {
    const dados = fs.readFileSync(nomeArquivo);
    return JSON.parse(dados);
  } else {
    return [];
  }
}

function writeJSONFile(nomeArquivo, dados) {
  const dadosJSON = JSON.stringify(dados, null, 2);
  fs.writeFileSync(nomeArquivo, dadosJSON);
}

//Gestão de dados sessão one 1

function addObject(numeroId, sessionid, numero, id, interact, maxObjects) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);

  // Verificar a unicidade do numeroId
  const existeNumeroId = dadosAtuais.some(objeto => objeto.numeroId === numeroId);
  if (existeNumeroId) {
    throw new Error('O numeroId já existe no banco de dados.');
  }

  const objeto = { numeroId, sessionid, numero, id, interact};

  if (dadosAtuais.length >= maxObjects) {
    // Excluir o objeto mais antigo
    dadosAtuais.shift();
  }

  dadosAtuais.push(objeto);
  writeJSONFile(DATABASE_FILE, dadosAtuais);
}

function readMap(numeroId) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  return objeto;
}

function deleteObject(numeroId) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const novosDados = dadosAtuais.filter(obj => obj.numeroId !== numeroId);
  writeJSONFile(DATABASE_FILE, novosDados);
}

function existsDB(numeroId) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  return dadosAtuais.some(obj => obj.numeroId === numeroId);
}

function readSessionId(numeroId) {
  const objeto = readMap(numeroId);
  return objeto ? objeto.sessionid : undefined;
}

function updateId(numeroId, id) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.id = id;
    writeJSONFile(DATABASE_FILE, dadosAtuais);
  }
}  

function readId(numeroId) {
  const objeto = readMap(numeroId);
  return objeto ? objeto.id : undefined;
}

function updateInteract(numeroId, interact) {
  const dadosAtuais = readJSONFile(DATABASE_FILE);
  const objeto = dadosAtuais.find(obj => obj.numeroId === numeroId);
  if (objeto) {
    objeto.interact = interact;
    writeJSONFile(DATABASE_FILE, dadosAtuais);
  }
}

function readInteract(numeroId) {
  const objeto = readMap(numeroId);
  return objeto ? objeto.interact : undefined;
}

async function createSessionJohnny(data, client) {
  const chat = await data.getChat();

  const reqData = JSON.stringify({
    isStreamEnabled: true,
    message: "string", // Substitua se necessário
    resultId: "string", // Substitua se necessário
    isOnlyRegistering: false,
    prefilledVariables: {
      number: data.from.split('@')[0],
      name: data.notifyName
    },
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: url_registro,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    data: reqData
  };

  try {
    const response = await axios.request(config);

    const messages = response.data.messages;
    
    for (const message of messages){
      if (message.type === 'text') {
        let formattedText = '';
        for (const richText of message.content.richText) {
          for (const element of richText.children) {
            let text = '';
    
            if (element.text) {
              text = element.text;
            } else if (element.type === 'inline-variable') {              
              text = element.children[0].children[0].text;
            }
    
            if (element.bold) {
              text = `*${text}*`;
            }
            if (element.italic) {
              text = `_${text}_`;
            }
            if (element.underline) {
              text = `~${text}~`;
            }
    
            formattedText += text;
          }
          formattedText += '\n';
        }
    
        formattedText = formattedText.replace(/\n$/, '');
        if (formattedText.startsWith('!wait')) {
          await waitWithDelay(formattedText);
        }
        if (formattedText.startsWith('!fim')) {
          if (existsDB(data.from)) {
            deleteObject(data.from);
          }
        }
        if (!(formattedText.startsWith('!wait')) && !(formattedText.startsWith('!fim'))) {
          let retries = 0;
          const maxRetries = 10; // Máximo de tentativas
          let delay = 6000; // Tempo inicial de espera em milissegundos
          
      
          const sendRequest = async () => {
              await chat.sendStateTyping(); // Simulando Digitação
              const response = await fetch('http://localhost:3000/sendMessage', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      destinatario: data.from,
                      mensagem: formattedText,
                      tipo: "text",
                      msg: data
                  })
              });
      
              if (!response.ok) {
                  throw new Error(`Request failed with status ${response.status}`);
              }
      
              return await response.json();
          };
      
          while (retries < maxRetries) {
              try {
                  await sendRequest();
                  restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                  break; // Sai do loop se a requisição for bem-sucedida
              } catch (error) {
                  retries++;
                  console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                  if (!restartAPI) {
                      myEmitter.emit('errorEvent', error);
                      restartAPI = true;
                  }
                  await new Promise(resolve => setTimeout(resolve, delay));
                  delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
              }
          }
      
          if (retries === maxRetries) {
              console.error('Erro: Número máximo de tentativas de envio atingido.');
          }
      }      
      }
      if (message.type === 'image') {
        let retries = 0;
        const maxRetries = 10; // Máximo de tentativas
        let delay = 6000; // Tempo inicial de espera em milissegundos
       
    
        const sendRequest = async () => {
            const media = await tratarMidia(message);
            const response = await fetch('http://localhost:3000/sendMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario: data.from,
                    media: media,
                    tipo: "image",
                    msg: data
                })
            });
    
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
    
            return await response.json();
        };
    
        while (retries < maxRetries) {
            try {
                await sendRequest();
                restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                break; // Sai do loop se a requisição for bem-sucedida
            } catch (error) {
                retries++;
                console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                if (!restartAPI) {
                    myEmitter.emit('errorEvent', error);
                    restartAPI = true;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
            }
        }
    
        if (retries === maxRetries) {
            console.error('Erro: Número máximo de tentativas de envio atingido.');
        }
      }                          
      if (message.type === 'video') {
        let retries = 0;
        const maxRetries = 10; // Máximo de tentativas
        let delay = 6000; // Tempo inicial de espera em milissegundos
        
    
        const sendRequest = async () => {
            const media = await tratarMidia(message);
            const response = await fetch('http://localhost:3000/sendMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario: data.from,
                    media: media,
                    tipo: "video",
                    msg: data
                })
            });
    
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
    
            return await response.json();
        };
    
        while (retries < maxRetries) {
            try {
                await sendRequest();
                restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                break; // Sai do loop se a requisição for bem-sucedida
            } catch (error) {
                retries++;
                console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                if (!restartAPI) {
                    myEmitter.emit('errorEvent', error);
                    restartAPI = true;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
            }
        }
    
        if (retries === maxRetries) {
            console.error('Erro: Número máximo de tentativas de envio atingido.');
        }
      }                            
      if (message.type === 'audio') {
        let retries = 0;
        const maxRetries = 10; // Máximo de tentativas
        let delay = 6000; // Tempo inicial de espera em milissegundos
        
    
        const sendRequest = async () => {
            const media = await tratarMidia(message);
            await chat.sendStateRecording(); // Simulando áudio gravando
            const response = await fetch('http://localhost:3000/sendMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario: data.from,
                    media: media,
                    tipo: "audio",                    
                    msg: data
                })
            });
    
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
    
            return await response.json();
        };
    
        while (retries < maxRetries) {
            try {
                await sendRequest();
                restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                break; // Sai do loop se a requisição for bem-sucedida
            } catch (error) {
                retries++;
                console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                if (!restartAPI) {
                    myEmitter.emit('errorEvent', error);
                    restartAPI = true;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
            }
        }
    
        if (retries === maxRetries) {
            console.error('Erro: Número máximo de tentativas de envio atingido.');
        }
      } 
    }
    if (!existsDB(data.from)) {
      addObject(data.from, response.data.sessionId, data.from.replace(/\D/g, ''), JSON.stringify(data.id.id), 'done', 400);
    }
  } catch (error) {
    console.log(error);
  }
}

async function waitWithDelay(inputString) {
    // Verifica se a string começa com '!wait'
    if (inputString.startsWith('!wait')) {
      // Extrai o número da string usando expressões regulares
      const match = inputString.match(/\d+/);
      
      if (match) {
        // Converte o número para um valor inteiro
        const delayInSeconds = parseInt(match[0]);
        
        // Aguarda o atraso usando o valor extraído
        await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));
        
        //console.log(`Aguardou ${delayInSeconds} segundos.`);
      } else {
        const defaultDelayInSeconds = 3;
        await new Promise(resolve => setTimeout(resolve, defaultDelayInSeconds * 1000));
      }
    }
}

async function tratarMidia(message) {  
    try {
      let fileUrl = message.content.url; // URL do arquivo
      let mimetype;
      let filename;

      // Use Axios para buscar o arquivo e determinar o MIME type.
      const attachment = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
      }).then(response => {
        mimetype = response.headers['content-type'];
        filename = fileUrl.split("/").pop();
        return response.data.toString('base64');
      });

      if (attachment) {
        const media = new MessageMedia(mimetype, attachment, filename);
        return media;
      }
    } catch (e) {
      console.error(e);
    }  
}

// Evento de recebimento de mensagens
client.on('message', async msg => {

  if(gatilho !== "null"){
    if (!existsDB(msg.from) && msg.from.endsWith('@c.us') && !msg.hasMedia && msg.body === gatilho){
      //send messages
      await createSessionJohnny(msg, client);
     }
    } else {
    if (!existsDB(msg.from) && msg.from.endsWith('@c.us') && !msg.hasMedia && msg.body !== null){
      //send messages
      await createSessionJohnny(msg, client);
     }
    }

    if (existsDB(msg.from) && msg.from.endsWith('@c.us')  && readInteract(msg.from) === 'done' && readId(msg.from) !== JSON.stringify(msg.id.id) && !msg.hasMedia && msg.body !== null){
          updateInteract(msg.from, 'typing');
          updateId(msg.from, JSON.stringify(msg.id.id));  
          const chat = await msg.getChat();
            const sessionId = readSessionId(msg.from);
            const content = msg.body;
            const chaturl = `${url_chat}${sessionId}/continueChat`;
            
            const reqData = {
              message: content,
            };
          
            const config = {
              method: 'post',
              maxBodyLength: Infinity,
              url: chaturl,
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              data: JSON.stringify(reqData),
            };
          
            try {
              const response = await axios.request(config);
              //console.log(JSON.stringify(response.data));
              const messages = response.data.messages;    
              for (const message of messages){
                if (message.type === 'text') {
                  let formattedText = '';
                  for (const richText of message.content.richText) {
                    for (const element of richText.children) {
                      let text = '';
              
                      if (element.text) {
                        text = element.text;
                      } else if (element.type === 'inline-variable') {              
                        text = element.children[0].children[0].text;
                      }
              
                      if (element.bold) {
                        text = `*${text}*`;
                      }
                      if (element.italic) {
                        text = `_${text}_`;
                      }
                      if (element.underline) {
                        text = `~${text}~`;
                      }
              
                      formattedText += text;
                    }
                    formattedText += '\n';
                  }
              
                  formattedText = formattedText.replace(/\n$/, '');
                  if (formattedText.startsWith('!wait')) {
                    await waitWithDelay(formattedText);
                  }
                  if (formattedText.startsWith('!fim')) {
                    if (existsDB(msg.from)) {
                      deleteObject(msg.from);
                    }
                  }
                if (!(formattedText.startsWith('!wait')) && !(formattedText.startsWith('!fim'))) {
                    let retries = 0;
                    const maxRetries = 10; // Máximo de tentativas
                    let delay = 6000; // Tempo inicial de espera em milissegundos                    
                
                    const sendRequest = async () => {
                        await chat.sendStateTyping(); // Simulando Digitação
                        const response = await fetch('http://localhost:3000/sendMessage', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                destinatario: msg.from,
                                mensagem: formattedText,
                                tipo: "text",
                                msg: msg
                            })
                        });
                
                        if (!response.ok) {
                            throw new Error(`Request failed with status ${response.status}`);
                        }
                
                        return await response.json();
                    };
                
                    while (retries < maxRetries) {
                        try {
                            await sendRequest();
                            restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                            break; // Sai do loop se a requisição for bem-sucedida
                        } catch (error) {
                            retries++;
                            console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                            if (!restartAPI) {
                                myEmitter.emit('errorEvent', error);
                                restartAPI = true;
                            }
                            await new Promise(resolve => setTimeout(resolve, delay));
                            delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                        }
                    }
                
                    if (retries === maxRetries) {
                        console.error('Erro: Número máximo de tentativas de envio atingido.');
                    }
                }                               
                }
                if (message.type === 'image') {
                  let retries = 0;
                  const maxRetries = 10; // Máximo de tentativas
                  let delay = 6000; // Tempo inicial de espera em milissegundos
                  
              
                  const sendRequest = async () => {
                      const media = await tratarMidia(message);
                      const response = await fetch('http://localhost:3000/sendMessage', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              destinatario: msg.from,
                              media: media,
                              tipo: "image",
                              msg: msg
                          })
                      });
              
                      if (!response.ok) {
                          throw new Error(`Request failed with status ${response.status}`);
                      }
              
                      return await response.json();
                  };
              
                  while (retries < maxRetries) {
                      try {
                          await sendRequest();
                          restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                          break; // Sai do loop se a requisição for bem-sucedida
                      } catch (error) {
                          retries++;
                          console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                          if (!restartAPI) {
                              myEmitter.emit('errorEvent', error);
                              restartAPI = true;
                          }
                          await new Promise(resolve => setTimeout(resolve, delay));
                          delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                      }
                  }
              
                  if (retries === maxRetries) {
                      console.error('Erro: Número máximo de tentativas de envio atingido.');
                  }
                }                          
                if (message.type === 'video') {
                  let retries = 0;
                  const maxRetries = 10; // Máximo de tentativas
                  let delay = 6000; // Tempo inicial de espera em milissegundos
                  
              
                  const sendRequest = async () => {
                      const media = await tratarMidia(message);
                      const response = await fetch('http://localhost:3000/sendMessage', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              destinatario: msg.from,
                              media: media,
                              tipo: "video",
                              msg: msg
                          })
                      });
              
                      if (!response.ok) {
                          throw new Error(`Request failed with status ${response.status}`);
                      }
              
                      return await response.json();
                  };
              
                  while (retries < maxRetries) {
                      try {
                          await sendRequest();
                          restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                          break; // Sai do loop se a requisição for bem-sucedida
                      } catch (error) {
                          retries++;
                          console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                          if (!restartAPI) {
                              myEmitter.emit('errorEvent', error);
                              restartAPI = true;
                          }
                          await new Promise(resolve => setTimeout(resolve, delay));
                          delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                      }
                  }
              
                  if (retries === maxRetries) {
                      console.error('Erro: Número máximo de tentativas de envio atingido.');
                  }
                }                            
                if (message.type === 'audio') {
                  let retries = 0;
                  const maxRetries = 10; // Máximo de tentativas
                  let delay = 6000; // Tempo inicial de espera em milissegundos
                  
              
                  const sendRequest = async () => {
                      const media = await tratarMidia(message);
                      await chat.sendStateRecording(); // Simulando áudio gravando
                      const response = await fetch('http://localhost:3000/sendMessage', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              destinatario: msg.from,
                              media: media,
                              tipo: "audio",                    
                              msg: msg
                          })
                      });
              
                      if (!response.ok) {
                          throw new Error(`Request failed with status ${response.status}`);
                      }
              
                      return await response.json();
                  };
              
                  while (retries < maxRetries) {
                      try {
                          await sendRequest();
                          restartAPI = false; // Reinicializa o flag quando a requisição é bem-sucedida
                          break; // Sai do loop se a requisição for bem-sucedida
                      } catch (error) {
                          retries++;
                          console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay}ms.`);
                          if (!restartAPI) {
                              myEmitter.emit('errorEvent', error);
                              restartAPI = true;
                          }
                          await new Promise(resolve => setTimeout(resolve, delay));
                          delay *= 2; // Dobrar o tempo de espera para a próxima tentativa
                      }
                  }
              
                  if (retries === maxRetries) {
                      console.error('Erro: Número máximo de tentativas de envio atingido.');
                  }
                }                           
              }
              updateInteract(msg.from, 'done');
            } catch (error) {
              console.log(error);
            }
            
    } 

});