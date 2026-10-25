import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
type Bookmark = { bookId: number; position: string; currentPage: number; label: string; createdAt: string };

function getReaderHtml(runtime: string, worker: string) {
  const workerSource = JSON.stringify(worker);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=4,user-scalable=yes"><style>
  *{box-sizing:border-box}body{margin:0;background:#f4efe2;color:#173f35;font:17px Georgia,serif}#reader{height:calc(100dvh - 52px);overflow:auto;padding:18px;touch-action:pan-x pan-y}#status{position:fixed;inset:0;display:grid;place-items:center;background:#f4efe2;color:#68786e;font:15px Arial,sans-serif}#pdf-page{display:block;max-width:none;height:auto;margin:24px auto;box-shadow:0 5px 24px #173f3526;background:#fff}#epub{height:100%;width:100%}#error{padding:28px;color:#173f35;font:16px Arial,sans-serif;line-height:1.5}#controls{height:52px;display:flex;gap:8px;align-items:center;justify-content:center;background:#173f35;color:#fffcf5;font:14px Arial,sans-serif}button{background:#d8c18b;border:0;border-radius:7px;color:#173f35;padding:8px 12px;font-weight:bold}
  </style></head><body><div id="status">Preparando seu livro…</div><div id="reader"></div><script>${runtime}</script><script>
  const workerSource=${workerSource};
  let pdf=null, pageNumber=1, rendition=null, saveTimer=null, pdfZoom=1, epubFontSize=100, activePdfRender=null;
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
    controls.innerHTML='<button id="prev" aria-label="Página anterior">‹</button><button id="zoom-out" aria-label="Diminuir zoom">−</button><span id="count"></span><button id="zoom-in" aria-label="Aumentar zoom">+</button><button id="next" aria-label="Próxima página">›</button>';
    document.body.insertBefore(controls,document.getElementById('reader'));
    document.getElementById('prev').onclick=()=>showPage(pageNumber-1);
    document.getElementById('next').onclick=()=>showPage(pageNumber+1);
    document.getElementById('zoom-out').onclick=()=>changePdfZoom(-0.2);
    document.getElementById('zoom-in').onclick=()=>changePdfZoom(0.2);
    document.getElementById('reader').addEventListener('click',event=>{
      if(event.target.closest('button'))return;
      const ratio=event.clientX/window.innerWidth;
      if(ratio<0.25)showPage(pageNumber-1);else if(ratio>0.75)showPage(pageNumber+1);
    });
    attachPdfPinch();
    await showPage(pageNumber);
  }
  function changePdfZoom(amount){pdfZoom=Math.max(1,Math.min(3,Math.round((pdfZoom+amount)*10)/10));showPage(pageNumber);}
  function attachPdfPinch(){let startDistance=0;const reader=document.getElementById('reader');reader.addEventListener('touchstart',event=>{if(event.touches.length===2)startDistance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);},{passive:true});reader.addEventListener('touchmove',event=>{if(event.touches.length!==2||!startDistance)return;event.preventDefault();const distance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);if(Math.abs(distance-startDistance)>18){changePdfZoom(distance>startDistance?0.2:-0.2);startDistance=distance;}},{passive:false});reader.addEventListener('touchend',()=>{startDistance=0;},{passive:true});}
  async function showPage(number){if(number<1||number>pdf.numPages)return;pageNumber=number;if(activePdfRender)activePdfRender.cancel();const page=await pdf.getPage(number);const ratio=Math.min(window.devicePixelRatio||1,2);const scale=(window.innerWidth-36)/page.getViewport({scale:1}).width;const viewport=page.getViewport({scale:scale*ratio*pdfZoom});const canvas=document.createElement('canvas');canvas.id='pdf-page';canvas.width=viewport.width;canvas.height=viewport.height;canvas.style.width=(viewport.width/ratio)+'px';canvas.style.height=(viewport.height/ratio)+'px';document.getElementById('reader').replaceChildren(canvas);const task=page.render({canvasContext:canvas.getContext('2d'),viewport});activePdfRender=task;try{await task.promise;}catch(error){if(error.name==='RenderingCancelledException')return;throw error;}finally{if(activePdfRender===task)activePdfRender=null;}page.cleanup();document.getElementById('count').textContent=number+' / '+pdf.numPages+' · '+Math.round(pdfZoom*100)+'%';savePosition(String(number),pdf.numPages);}
  async function renderEpub(uri,position){
    const bytes=await readLocalFile(uri);
    const book=BentoraReader.ePub(bytes);await book.ready;
    const spineItems=book.spine.items;const current=Number(position)||1;
    rendition=book.renderTo('reader',{width:'100%',height:'100%',flow:'paginated',spread:'none'});
    rendition.on('relocated',location=>{const index=(location.start&&location.start.index||0)+1;pageNumber=index;document.getElementById('count').textContent='Capítulo '+index+' / '+spineItems.length;savePosition(location.start&&location.start.cfi||String(index),spineItems.length);});
    rendition.on('rendered',(section,view)=>attachEpubGestures(view));
    document.getElementById('status').style.display='none';
    const controls=document.createElement('div');controls.id='controls';
    controls.innerHTML='<button id="prev" aria-label="Página anterior">‹</button><button id="zoom-out" aria-label="Diminuir texto">−</button><span id="count"></span><button id="zoom-in" aria-label="Aumentar texto">+</button><button id="next" aria-label="Próxima página">›</button>';
    document.body.insertBefore(controls,document.getElementById('reader'));
    document.getElementById('prev').onclick=()=>rendition.prev();
    document.getElementById('next').onclick=()=>rendition.next();
    document.getElementById('zoom-out').onclick=()=>changeEpubZoom(-10);
    document.getElementById('zoom-in').onclick=()=>changeEpubZoom(10);
    await rendition.display(current>1&&spineItems[current-1]?spineItems[current-1].href:undefined);
    if(position&&String(position).startsWith('epubcfi('))await rendition.display(position);
  }
  function changeEpubZoom(amount){epubFontSize=Math.max(70,Math.min(200,epubFontSize+amount));rendition.themes.fontSize(epubFontSize+'%');document.getElementById('count').textContent='Capítulo '+pageNumber+' · '+epubFontSize+'%';}
  function attachEpubGestures(view){const contents=view&&view.contents;if(!contents||!contents.document)return;const doc=contents.document;doc.addEventListener('click',event=>{if(event.target.closest('a'))return;const ratio=event.clientX/contents.window.innerWidth;if(ratio<0.25)rendition.prev();else if(ratio>0.75)rendition.next();});let startDistance=0;doc.addEventListener('touchstart',event=>{if(event.touches.length===2)startDistance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);},{passive:true});doc.addEventListener('touchmove',event=>{if(event.touches.length!==2||!startDistance)return;event.preventDefault();const distance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);if(Math.abs(distance-startDistance)>24){changeEpubZoom(distance>startDistance?10:-10);startDistance=distance;}},{passive:false});doc.addEventListener('touchend',()=>{startDistance=0;},{passive:true});}
  window.goToReaderPosition=position=>{if(pdf)showPage(Number(position));else if(rendition)rendition.display(position);};
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
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [bookmarksVisible, setBookmarksVisible] = useState(false);

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

  const loadBookmarks = useCallback(async () => {
    const result = await db.getAllAsync<Bookmark>(
      'SELECT bookId, position, currentPage, label, createdAt FROM readerBookmarks WHERE bookId = ? ORDER BY createdAt DESC',
      id
    );
    setBookmarks(result);
  }, [db, id]);

  const addBookmark = async () => {
    const current = latestPosition.current;
    if (!current) {
      Alert.alert('Leitor carregando', 'Aguarde a página aparecer para marcá-la.');
      return;
    }
    const label = `${fileType === 'pdf' ? 'Página' : 'Capítulo'} ${current.currentPage}`;
    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO readerBookmarks (bookId, position, currentPage, label, createdAt) VALUES (?, ?, ?, ?, ?)',
        id, current.position, current.currentPage, label, new Date().toISOString()
      );
      await loadBookmarks();
      Alert.alert('Marcador salvo', `${label} foi adicionado aos marcadores deste livro.`);
    } catch (bookmarkError) {
      console.error(bookmarkError);
      Alert.alert('Erro', 'Não foi possível salvar este marcador.');
    }
  };

  const openBookmark = (bookmark: Bookmark) => {
    webViewRef.current?.injectJavaScript(
      `window.goToReaderPosition(${JSON.stringify(bookmark.position)}); true;`
    );
    setBookmarksVisible(false);
  };

  const removeBookmark = async (bookmark: Bookmark) => {
    await db.runAsync(
      'DELETE FROM readerBookmarks WHERE bookId = ? AND position = ?',
      bookmark.bookId, bookmark.position
    );
    await loadBookmarks();
  };

  useEffect(() => { void loadBookmarks(); }, [loadBookmarks]);

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
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.back}>‹ Biblioteca</Text>
          </TouchableOpacity>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          <Text style={styles.format}>{fileType.toUpperCase()}</Text>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.headerButton} onPress={() => void addBookmark()} accessibilityRole="button">
            <Text style={styles.headerButtonText}>Marcar página</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setBookmarksVisible(true)} accessibilityRole="button">
            <Text style={styles.headerButtonText}>Marcadores ({bookmarks.length})</Text>
          </TouchableOpacity>
        </View>
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
      <Modal visible={bookmarksVisible} transparent animationType="slide" onRequestClose={() => setBookmarksVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>Marcadores</Text>
              <TouchableOpacity onPress={() => setBookmarksVisible(false)}><Text style={styles.closeButton}>Fechar</Text></TouchableOpacity>
            </View>
            {bookmarks.length === 0 ? (
              <Text style={styles.emptyText}>As páginas marcadas neste livro aparecerão aqui.</Text>
            ) : (
              <ScrollView style={styles.bookmarkList}>
                {bookmarks.map((bookmark) => (
                  <View key={bookmark.position} style={styles.bookmarkRow}>
                    <TouchableOpacity style={styles.bookmarkOpen} onPress={() => openBookmark(bookmark)}>
                      <Text style={styles.bookmarkLabel}>{bookmark.label}</Text>
                      <Text style={styles.bookmarkDate}>{new Date(bookmark.createdAt).toLocaleDateString()}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => void removeBookmark(bookmark)} accessibilityLabel={`Excluir ${bookmark.label}`}>
                      <Text style={styles.removeBookmark}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.background },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  headerButton: { borderWidth: 1, borderColor: COLORS.gold, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  headerButtonText: { color: COLORS.gold, fontSize: 12, fontWeight: '600' },
  back: { color: COLORS.gold, fontSize: 15, fontWeight: '600' },
  title: { color: COLORS.surface, flex: 1, fontSize: 15, fontWeight: '600' },
  format: { color: COLORS.gold, fontSize: 11, fontWeight: '700' },
  webview: { flex: 1, backgroundColor: COLORS.cream },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  messageText: { color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  modalCard: { maxHeight: '70%', minHeight: 220, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: COLORS.cream },
  modalHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
  closeButton: { color: COLORS.background, fontWeight: '600', padding: 8 },
  bookmarkList: { flexGrow: 0 },
  bookmarkRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 12 },
  bookmarkOpen: { flex: 1 },
  bookmarkLabel: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  bookmarkDate: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  removeBookmark: { color: COLORS.danger, padding: 8, fontWeight: '600' },
  emptyText: { color: COLORS.textSecondary, lineHeight: 22, marginTop: 10 },
});
