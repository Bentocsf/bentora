import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import COLORS from '../theme/colors';
import type { LibraryStackParamList } from '../navigation/LibraryStack';

type Props = NativeStackScreenProps<LibraryStackParamList, 'Reader'>;
type PositionMessage = { type: 'position'; currentPage: number; totalPages: number; position: string };
type ReaderMessage = { type: 'ready' } | PositionMessage;

function getReaderHtml(runtime: string, worker: string) {
  const workerSource = JSON.stringify(worker);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
  *{box-sizing:border-box}body{margin:0;background:#f4efe2;color:#173f35;font:17px Georgia,serif}#reader{height:calc(100dvh - 48px);overflow:auto;padding:18px}#status{position:fixed;inset:0;display:grid;place-items:center;background:#f4efe2;color:#68786e;font:15px Arial,sans-serif}#pdf-page{display:block;max-width:100%;height:auto;margin:24px auto;box-shadow:0 5px 24px #173f3526;background:#fff}#epub{height:100%;width:100%}#error{padding:28px;color:#173f35;font:16px Arial,sans-serif;line-height:1.5}#controls{height:48px;display:flex;gap:12px;align-items:center;justify-content:center;background:#173f35;color:#fffcf5;font:14px Arial,sans-serif}button{background:#d8c18b;border:0;border-radius:7px;color:#173f35;padding:8px 14px;font-weight:bold}
  </style></head><body><div id="status">Preparando seu livro…</div><div id="reader"></div><script>${runtime}</script><script>
  const workerSource=${workerSource};
  let pdf=null, pageNumber=1, rendition=null, saveTimer=null;
  const send=(message)=>window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(message));
  const showError=(message)=>{document.getElementById('status').style.display='none';document.getElementById('reader').innerHTML='<div id="error">'+message+'</div>';};
  const savePosition=(position,total)=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>send({type:'position',currentPage:pageNumber,totalPages:total,position}),300);};
  const readLocalFile=(uri)=>new Promise((resolve,reject)=>{const request=new XMLHttpRequest();request.open('GET',uri,true);request.responseType='arraybuffer';request.onload=()=>request.status===0||request.status<400?resolve(request.response):reject(new Error('Arquivo inacessível'));request.onerror=()=>reject(new Error('Arquivo inacessível'));request.send();});
  async function renderPdf(uri,position){
    const workerUrl=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
    BentoraReader.pdfjsLib.GlobalWorkerOptions.workerPort=new Worker(workerUrl,{type:'module'});
    const bytes=await readLocalFile(uri);
    pdf=await BentoraReader.pdfjsLib.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;
    pageNumber=Math.min(Math.max(Number(position)||1,1),pdf.numPages);
    document.getElementById('status').style.display='none';
    const controls=document.createElement('div');controls.id='controls';
    controls.innerHTML='<button id="prev">‹ Anterior</button><span id="count"></span><button id="next">Próxima ›</button>';
    document.body.insertBefore(controls,document.getElementById('reader'));
    document.getElementById('prev').onclick=()=>showPage(pageNumber-1);
    document.getElementById('next').onclick=()=>showPage(pageNumber+1);
    await showPage(pageNumber);
  }
  async function showPage(number){if(number<1||number>pdf.numPages)return;pageNumber=number;const page=await pdf.getPage(number);const ratio=Math.min(window.devicePixelRatio||1,2);const scale=(window.innerWidth-36)/page.getViewport({scale:1}).width;const viewport=page.getViewport({scale:scale*ratio});const canvas=document.createElement('canvas');canvas.id='pdf-page';canvas.width=viewport.width;canvas.height=viewport.height;canvas.style.width=(viewport.width/ratio)+'px';canvas.style.height=(viewport.height/ratio)+'px';document.getElementById('reader').replaceChildren(canvas);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;page.cleanup();document.getElementById('count').textContent=number+' / '+pdf.numPages;savePosition(String(number),pdf.numPages);}
  async function renderEpub(uri,position){
    const bytes=await readLocalFile(uri);
    const book=BentoraReader.ePub(bytes);await book.ready;
    const spineItems=book.spine.items;const current=Number(position)||1;
    rendition=book.renderTo('reader',{width:'100%',height:'100%',flow:'paginated',spread:'none'});
    rendition.on('relocated',location=>{const index=(location.start&&location.start.index||0)+1;pageNumber=index;document.getElementById('count').textContent='Capítulo '+index+' / '+spineItems.length;savePosition(location.start&&location.start.cfi||String(index),spineItems.length);});
    document.getElementById('status').style.display='none';
    const controls=document.createElement('div');controls.id='controls';
    controls.innerHTML='<button id="prev">‹ Anterior</button><span id="count"></span><button id="next">Próxima ›</button>';
    document.body.insertBefore(controls,document.getElementById('reader'));
    document.getElementById('prev').onclick=()=>rendition.prev();
    document.getElementById('next').onclick=()=>rendition.next();
    await rendition.display(current>1&&spineItems[current-1]?spineItems[current-1].href:undefined);
    if(position&&String(position).startsWith('epubcfi('))await rendition.display(position);
  }
  window.startBentoraReader=async({uri,format,position})=>{try{if(format==='pdf')await renderPdf(uri,position);else await renderEpub(uri,position);}catch(error){console.error(error);showError('Não foi possível abrir este arquivo. Verifique se ele é um PDF ou EPUB válido e sem proteção por senha.');}};
  send({type:'ready'});
  </script></body></html>`;
}

export default function ReaderScreen({ route, navigation }: Props) {
  const { id, title, fileUri, fileType, readerPosition } = route.params;
  const db = useSQLiteContext();
  const webViewRef = useRef<WebView<{}>>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPosition = useRef<PositionMessage | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const prepare = async () => {
      try {
        const [runtimeAsset, workerAsset] = await Promise.all([
          Asset.fromModule(require('../assets/reader/reader-runtime.html')).downloadAsync(),
          Asset.fromModule(require('../assets/reader/pdf-worker.html')).downloadAsync(),
        ]);
        if (!runtimeAsset.localUri || !workerAsset.localUri || !FileSystem.documentDirectory) {
          throw new Error('Não foi possível preparar o leitor local.');
        }
        const [runtime, worker] = await Promise.all([
          FileSystem.readAsStringAsync(runtimeAsset.localUri),
          FileSystem.readAsStringAsync(workerAsset.localUri),
        ]);
        const readerHtml = getReaderHtml(runtime, worker);
        const readerPath = `${FileSystem.documentDirectory}bentora-reader.html`;
        await FileSystem.writeAsStringAsync(readerPath, readerHtml);
        if (mounted) setHtml(readerPath);
      } catch (prepareError) {
        console.error(prepareError);
        if (mounted) setError(true);
      }
    };
    void prepare();
    return () => { mounted = false; };
  }, []);

  const savePosition = useCallback(async (position: PositionMessage) => {
    latestPosition.current = position;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await db.runAsync(
        `UPDATE books SET readerPosition = ?, currentPage = ?, totalPages = ?,
         status = CASE WHEN status = 'Concluído' THEN status ELSE 'Lendo' END,
         startedAt = CASE WHEN startedAt IS NULL THEN ? ELSE startedAt END WHERE id = ?`,
        position.position, position.currentPage, position.totalPages,
        new Date().toISOString(), id
      );
    }, 500);
  }, [db, id]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const position = latestPosition.current;
    if (position) {
      void db.runAsync(
        `UPDATE books SET readerPosition = ?, currentPage = ?, totalPages = ?,
         status = CASE WHEN status = 'Concluído' THEN status ELSE 'Lendo' END,
         startedAt = CASE WHEN startedAt IS NULL THEN ? ELSE startedAt END WHERE id = ?`,
        position.position, position.currentPage, position.totalPages,
        new Date().toISOString(), id
      );
    }
  }, [db, id]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as ReaderMessage;
      if (message.type === 'ready') {
        const position = fileType === 'epub' && readerPosition?.startsWith('epubcfi(')
          ? readerPosition
          : String(readerPosition || route.params.currentPage || 1);
        webViewRef.current?.injectJavaScript(
          `window.startBentoraReader(${JSON.stringify({ uri: fileUri, format: fileType, position })}); true;`
        );
      } else if (message.type === 'position') {
        void savePosition(message);
      }
    } catch (parseError) {
      console.error(parseError);
    }
  };

  const source = useMemo(() => html ? { uri: html } : undefined, [html]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.back}>‹ Biblioteca</Text>
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <Text style={styles.format}>{fileType.toUpperCase()}</Text>
      </View>
      {error ? (
        <View style={styles.message}><Text style={styles.messageText}>Não foi possível preparar o leitor. Reabra o livro e tente novamente.</Text></View>
      ) : source ? (
        <WebView<{}>
          ref={webViewRef}
          source={source}
          originWhitelist={['*']}
          allowingReadAccessToURL={FileSystem.documentDirectory ?? undefined}
          allowFileAccess
          allowFileAccessFromFileURLs
          javaScriptEnabled
          onMessage={handleMessage}
          onError={() => Alert.alert('Erro de leitura', 'Não foi possível abrir o arquivo selecionado.')}
          style={styles.webview}
        />
      ) : (
        <View style={styles.message}><ActivityIndicator color={COLORS.gold} /><Text style={styles.messageText}>Preparando seu livro…</Text></View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.background },
  back: { color: COLORS.gold, fontSize: 15, fontWeight: '600' },
  title: { color: COLORS.surface, flex: 1, fontSize: 15, fontWeight: '600' },
  format: { color: COLORS.gold, fontSize: 11, fontWeight: '700' },
  webview: { flex: 1, backgroundColor: COLORS.cream },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  messageText: { color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
});
