const rootBookmarkName=["ブックマーク バー","自動タブ保存"];
const snapShotDirectoryName = "スナップショット保存";
const dailyDirectoryname    = "デイリー保存";

chrome.runtime.onStartup.addListener(()=>{save();});
chrome.runtime.onInstalled.addListener(function() {
	//各時の0分～55分 次の時に初回発火
	//56分～59分 次の次の時に発火
	const now = new Date();
	let  when = new Date(now.getFullYear(),now.getMonth(),now.getDate(),now.getHours()).getTime();
	if( now.getMinutes() <= 55 ){
		when += 1*60*60*1000;
	}else{
		when += 2*60*60*1000;
	}
	chrome.alarms.create('save', { when:when , periodInMinutes: 60 });
	save();
});
chrome.alarms.onAlarm.addListener(function(alarm) {
	if ( alarm.name == "save" ){
		save();
	}
});

function save(){
	saveTabsForDaily();
	saveTabsForHourl();
	deleteOldHourlFolder();
}
function saveTabsForDaily(){
	// 1日一回、全てのタブを保存する。既に日別のフォルダがあったらスキップ
	// デイリー保存/ 2017/01/01 / ウィンドウ0 / 色々
	const d = new Date();
	const folderNameYear  = d.getFullYear() + "";
	const folderNameMonth = ("00"+(d.getMonth()+1)).substr(-2);
	const folderNameDate  = ("00"+(d.getDate())).substr(-2);
	saveAllTabs([ dailyDirectoryname , folderNameYear , folderNameMonth , folderNameDate ]);
}
function saveTabsForHourl(){
	// 1時間に1回、全てのタブを保存する。
	const d = new Date();
	let timeFormat = "";
	timeFormat += d.getFullYear();
	timeFormat += "/";
	timeFormat += ("00"+(d.getMonth()+1)).substr(-2);
	timeFormat += "/";
	timeFormat += ("00"+(d.getDate())).substr(-2);
	timeFormat += " ";
	timeFormat += ("00"+(d.getHours())).substr(-2);
	timeFormat += ":";
	timeFormat += ("00"+(d.getMinutes())).substr(-2);
	timeFormat += ":";
	timeFormat += ("00"+(d.getSeconds())).substr(-2);
	saveAllTabs([ snapShotDirectoryName , timeFormat ]);
}
async function deleteOldHourlFolder(){
	//スナップショット保存から一番古いフォルダを消す
	const limit = 100;
	let currentDirectory = await getRootBookmarkDirectoryId();
	currentDirectory = getDirectoryObject(currentDirectory,snapShotDirectoryName);
	if( currentDirectory == null){
		return;
	}
	if( currentDirectory.children == undefined || currentDirectory.children.length <= limit ){
		return;
	}
	let deleteFolderId;
	{
		let a = [];
		currentDirectory.children.forEach(item=>a.push({id:item.id,date:item.dateAdded}));
		a.sort((a,b)=>{return a.date-b.date;});
		deleteFolderId = a[0].id;
	}
	await removeTree( deleteFolderId );
}
async function saveAllTabs(directoryName){
	// 指定されたフォルダに全てのタブを保存する。タブが存在したら何もせず戻る
	let currentDirectory = await getRootBookmarkDirectoryId();
	{
		const d = new Date();
		currentDirectory = await makeDirectory( currentDirectory ,directoryName);
	}
	// 既にある時はスキップ
	if( currentDirectory.children != undefined &&  0 < currentDirectory.children.length ){
		return;
	}
	const allTabs = await getAllTabs();
	let windowIds = [];
	for( let tab of allTabs ){
		if(!windowIds.includes(tab.windowId)){
			windowIds.push(tab.windowId);
		}
	}
	// windowIdごとに作成
	for( let windowId of windowIds ){
		const directoryPerWindowId = await createBookmark({parentId:currentDirectory.id,title:`ウィンドウ ${windowId}`});
		for( let tab of allTabs ){
			if( tab.windowId != windowId ){
				continue;
			}
			// {parentId:parentId,title:title,url:url}
			await createBookmark({parentId:directoryPerWindowId.id,title:tab.title,url:tab.url});
		}
	}
}
async function getRootBookmarkDirectoryId(){
	let currentDirectory = (await getBookmarkTree())[0];
	for(let i of rootBookmarkName){
		currentDirectory = getDirectoryObject(currentDirectory,i);
		if( currentDirectory == null ){
			return null;
		}
	}
	return currentDirectory;
}
//Utils - bookmarkObject
function getDirectoryObject(rootDirectory,directoryName){
	if(!rootDirectory.children){return null;}
	for(let i of rootDirectory.children){
		if(i.url){continue;}
		if(i.title==directoryName){return i;};
	}
	return null;
}
async function makeDirectory(rootDirectory,directoryNames){
	const make1 = (parentId,name)=>{return new Promise(ok=>{
		chrome.bookmarks.create({parentId:parentId,title:name},r=>{ok(r);});
	})};
	let existDirectory = true;
	let currentDirectory = rootDirectory;
	for(let i of directoryNames){
		const j = getDirectoryObject(currentDirectory,i);
		if( j == null ){
			existDirectory = false;
			currentDirectory = await make1( currentDirectory.id , i );
		}else{
			currentDirectory = j;
		}
	}
	return currentDirectory;
}
//Promise
function getBookmarkTree(){
	return new Promise((resolve,reject)=>{
		chrome.bookmarks.getTree(r=>{resolve(r)});
	});
}
function createBookmark(obj){
//	console.log(`saveBookMark ${JSON.stringify(obj)}`);
	return new Promise((resolve,reject)=>{
		chrome.bookmarks.create(obj,r=>{resolve(r);});
	});
}
function removeTree(id){
	return new Promise((resolve,reject)=>{
		chrome.bookmarks.removeTree(id,r=>{resolve(r);});
	});
}
function getAllTabs(){
	return new Promise(ok=>{
		chrome.tabs.query({},r=>{
			ok(r);
		})
	});
}
