// 
//  FAIRWAY FRIEND — Main App Entry Point
// ============================================================

import { initAuth, setListenersActive, doLogin, doSignup, doSignOut, buildAuthScreen, friendlyError } from "./auth.js?v=110";
import { saveVibes, saveOnboardingData, saveProfileData, updateProfileUI, uploadProfilePhoto, myProfile, myVibes, deleteAccount, downgradeSubscription } from "./profile.js?v=110";
import { initFeed, initNearbyPlayers, submitPost, openTeeSheet, filterPlayers, toggleFollow, deletePost, toggleLike, submitReply, loadReplies, allPlayers } from "./feed.js?v=110";
import { buildScoreTable, onScoreChange, onBbbChange, saveRound, loadRoundHistory, resetScores, applyApiCourseData, resetHolesToDefault, buildGamePanel, setGameMode, updateTotals, MODES, addPlayerPrompt, addPlayerByName, addPlayerByUid, removePlayer, searchPlayersForCard } from "./scorecard.js?v=110";
import { startGpsRound, stopGpsRound, logShot, nextHole, prevHole, gpsIsActive, fetchCourseHoles } from "./gps.js?v=110";
import { openCourseLayout, closeCourseLayout, selectLayoutHole } from "./course-layout.js?v=110";
import { goScreen, showToast, toggleChip, initials, avatarColor, esc } from "./ui.js?v=110";
import { loadWeather, loadWeatherForCity, loadRoundDayForecast, startLocationWatch, stopLocationWatch } from "./weather.js?v=110";
import { getOrCreateConversation, createGroupConversation, sendMessage, listenToMessages, stopListeningMessages, listenToConversations, teardownMessaging, renderConversationsList, renderMessages, loadFollowing, renderFollowingForSearch, blockUser } from "./messages.js?v=110";
import { loadUserActivity, renderActivity, deleteActivityItem, toggleHideItem } from "./activity.js?v=110";
import { initNotifications, teardownNotifications, markAllNotifsRead, openNotif, loadNotificationsScreen, markConversationRead, createNotification } from "./notifications.js?v=110";
import { buildOnboardScreen } from "./onboard.js?v=110";


// ── Haversine distance in miles ──
function _haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Expose all UI actions to inline HTML onclick handlers ──
const COURSE_SCORECARDS = {"TPC Tampa Bay":[{"h":1,"par":4,"hcp":11,"yards":{"TPC":383,"BLUE":371,"GREEN":355,"WHITE":333,"RED":292}},{"h":2,"par":3,"hcp":13,"yards":{"TPC":187,"BLUE":178,"GREEN":168,"WHITE":157,"RED":120}},{"h":3,"par":4,"hcp":7,"yards":{"TPC":427,"BLUE":400,"GREEN":390,"WHITE":344,"RED":302}},{"h":4,"par":4,"hcp":3,"yards":{"TPC":424,"BLUE":397,"GREEN":383,"WHITE":371,"RED":308}},{"h":5,"par":4,"hcp":15,"yards":{"TPC":331,"BLUE":320,"GREEN":306,"WHITE":284,"RED":230}},{"h":6,"par":3,"hcp":17,"yards":{"TPC":149,"BLUE":140,"GREEN":130,"WHITE":120,"RED":93}},{"h":7,"par":5,"hcp":9,"yards":{"TPC":539,"BLUE":532,"GREEN":525,"WHITE":495,"RED":414}},{"h":8,"par":4,"hcp":5,"yards":{"TPC":422,"BLUE":409,"GREEN":390,"WHITE":359,"RED":310}},{"h":9,"par":4,"hcp":1,"yards":{"TPC":473,"BLUE":433,"GREEN":412,"WHITE":356,"RED":314}},{"h":10,"par":4,"hcp":10,"yards":{"TPC":401,"BLUE":385,"GREEN":352,"WHITE":332,"RED":299}},{"h":11,"par":3,"hcp":18,"yards":{"TPC":178,"BLUE":168,"GREEN":162,"WHITE":126,"RED":86}},{"h":12,"par":5,"hcp":14,"yards":{"TPC":485,"BLUE":476,"GREEN":476,"WHITE":460,"RED":382}},{"h":13,"par":4,"hcp":16,"yards":{"TPC":342,"BLUE":332,"GREEN":320,"WHITE":297,"RED":247}},{"h":14,"par":5,"hcp":6,"yards":{"TPC":586,"BLUE":572,"GREEN":531,"WHITE":512,"RED":447}},{"h":15,"par":4,"hcp":2,"yards":{"TPC":459,"BLUE":434,"GREEN":379,"WHITE":361,"RED":281}},{"h":16,"par":4,"hcp":8,"yards":{"TPC":428,"BLUE":417,"GREEN":403,"WHITE":369,"RED":327}},{"h":17,"par":3,"hcp":12,"yards":{"TPC":217,"BLUE":202,"GREEN":180,"WHITE":156,"RED":102}},{"h":18,"par":4,"hcp":4,"yards":{"TPC":456,"BLUE":442,"GREEN":411,"WHITE":413,"RED":299}}],"Heritage Harbor Golf & Country Club":[{"h":1,"par":4,"hcp":12,"yards":{"GOLD":339,"BLUE":304,"WHITE":280,"RED":247}},{"h":2,"par":4,"hcp":14,"yards":{"GOLD":298,"BLUE":284,"WHITE":226,"RED":211}},{"h":3,"par":3,"hcp":18,"yards":{"GOLD":179,"BLUE":150,"WHITE":134,"RED":92}},{"h":4,"par":4,"hcp":6,"yards":{"GOLD":416,"BLUE":389,"WHITE":294,"RED":283}},{"h":5,"par":5,"hcp":4,"yards":{"GOLD":517,"BLUE":460,"WHITE":440,"RED":380}},{"h":6,"par":4,"hcp":8,"yards":{"GOLD":413,"BLUE":396,"WHITE":354,"RED":306}},{"h":7,"par":3,"hcp":16,"yards":{"GOLD":212,"BLUE":181,"WHITE":169,"RED":118}},{"h":8,"par":5,"hcp":2,"yards":{"GOLD":534,"BLUE":472,"WHITE":435,"RED":376}},{"h":9,"par":4,"hcp":10,"yards":{"GOLD":373,"BLUE":343,"WHITE":316,"RED":267}},{"h":10,"par":5,"hcp":3,"yards":{"GOLD":550,"BLUE":532,"WHITE":478,"RED":425}},{"h":11,"par":4,"hcp":11,"yards":{"GOLD":388,"BLUE":342,"WHITE":317,"RED":257}},{"h":12,"par":4,"hcp":5,"yards":{"GOLD":417,"BLUE":329,"WHITE":296,"RED":266}},{"h":13,"par":4,"hcp":7,"yards":{"GOLD":416,"BLUE":358,"WHITE":325,"RED":287}},{"h":14,"par":3,"hcp":15,"yards":{"GOLD":258,"BLUE":131,"WHITE":117,"RED":98}},{"h":15,"par":5,"hcp":1,"yards":{"GOLD":587,"BLUE":523,"WHITE":487,"RED":460}},{"h":16,"par":3,"hcp":17,"yards":{"GOLD":170,"BLUE":135,"WHITE":122,"RED":90}},{"h":17,"par":4,"hcp":13,"yards":{"GOLD":402,"BLUE":346,"WHITE":315,"RED":282}},{"h":18,"par":4,"hcp":9,"yards":{"GOLD":374,"BLUE":332,"WHITE":309,"RED":270}}],"Innisbrook Resort - Copperhead Course":[{"h":1,"par":5,"hcp":5,"yards":{"BLACK":560,"GREEN":528,"WHITE":521,"GOLD":456,"RED":456}},{"h":2,"par":4,"hcp":11,"yards":{"BLACK":413,"GREEN":371,"WHITE":359,"GOLD":331,"RED":291}},{"h":3,"par":4,"hcp":7,"yards":{"BLACK":442,"GREEN":407,"WHITE":386,"GOLD":362,"RED":291}},{"h":4,"par":3,"hcp":17,"yards":{"BLACK":188,"GREEN":163,"WHITE":140,"GOLD":134,"RED":95}},{"h":5,"par":5,"hcp":1,"yards":{"BLACK":607,"GREEN":570,"WHITE":526,"GOLD":458,"RED":388}},{"h":6,"par":4,"hcp":3,"yards":{"BLACK":452,"GREEN":422,"WHITE":406,"GOLD":357,"RED":304}},{"h":7,"par":4,"hcp":13,"yards":{"BLACK":410,"GREEN":373,"WHITE":345,"GOLD":335,"RED":273}},{"h":8,"par":3,"hcp":15,"yards":{"BLACK":232,"GREEN":201,"WHITE":176,"GOLD":168,"RED":124}},{"h":9,"par":4,"hcp":9,"yards":{"BLACK":420,"GREEN":392,"WHITE":378,"GOLD":343,"RED":294}},{"h":10,"par":4,"hcp":8,"yards":{"BLACK":441,"GREEN":410,"WHITE":374,"GOLD":343,"RED":295}},{"h":11,"par":5,"hcp":6,"yards":{"BLACK":567,"GREEN":525,"WHITE":514,"GOLD":503,"RED":372}},{"h":12,"par":4,"hcp":12,"yards":{"BLACK":373,"GREEN":357,"WHITE":343,"GOLD":343,"RED":315}},{"h":13,"par":3,"hcp":18,"yards":{"BLACK":199,"GREEN":179,"WHITE":148,"GOLD":144,"RED":102}},{"h":14,"par":5,"hcp":2,"yards":{"BLACK":590,"GREEN":561,"WHITE":532,"GOLD":505,"RED":448}},{"h":15,"par":3,"hcp":14,"yards":{"BLACK":208,"GREEN":182,"WHITE":172,"GOLD":160,"RED":158}},{"h":16,"par":4,"hcp":4,"yards":{"BLACK":458,"GREEN":412,"WHITE":376,"GOLD":336,"RED":294}},{"h":17,"par":3,"hcp":16,"yards":{"BLACK":206,"GREEN":181,"WHITE":171,"GOLD":161,"RED":118}},{"h":18,"par":4,"hcp":10,"yards":{"BLACK":443,"GREEN":390,"WHITE":376,"GOLD":328,"RED":261}}],"Northdale Golf & Tennis Club":[{"h":1,"par":5,"hcp":5,"yards":{"Blue":511,"White":487,"Gold":468,"Red":449}},{"h":2,"par":4,"hcp":9,"yards":{"Blue":350,"White":321,"Gold":305,"Red":288}},{"h":3,"par":4,"hcp":1,"yards":{"Blue":430,"White":395,"Gold":371,"Red":340}},{"h":4,"par":3,"hcp":15,"yards":{"Blue":174,"White":155,"Gold":138,"Red":120}},{"h":5,"par":4,"hcp":7,"yards":{"Blue":381,"White":361,"Gold":343,"Red":316}},{"h":6,"par":5,"hcp":3,"yards":{"Blue":517,"White":498,"Gold":472,"Red":444}},{"h":7,"par":3,"hcp":17,"yards":{"Blue":168,"White":149,"Gold":137,"Red":112}},{"h":8,"par":4,"hcp":13,"yards":{"Blue":372,"White":352,"Gold":330,"Red":302}},{"h":9,"par":4,"hcp":11,"yards":{"Blue":388,"White":359,"Gold":344,"Red":295}},{"h":10,"par":4,"hcp":4,"yards":{"Blue":400,"White":372,"Gold":351,"Red":333}},{"h":11,"par":5,"hcp":2,"yards":{"Blue":536,"White":515,"Gold":497,"Red":454}},{"h":12,"par":4,"hcp":10,"yards":{"Blue":358,"White":341,"Gold":323,"Red":299}},{"h":13,"par":3,"hcp":18,"yards":{"Blue":196,"White":177,"Gold":152,"Red":130}},{"h":14,"par":4,"hcp":6,"yards":{"Blue":404,"White":377,"Gold":363,"Red":332}},{"h":15,"par":4,"hcp":12,"yards":{"Blue":362,"White":341,"Gold":325,"Red":286}},{"h":16,"par":5,"hcp":8,"yards":{"Blue":521,"White":497,"Gold":470,"Red":445}},{"h":17,"par":3,"hcp":16,"yards":{"Blue":178,"White":153,"Gold":137,"Red":124}},{"h":18,"par":4,"hcp":14,"yards":{"Blue":385,"White":371,"Gold":350,"Red":309}}],"Babe Zaharias Golf Course":[{"h":1,"par":4,"hcp":16,"yards":{"Back":330,"Middle":312,"Senior":312,"Forward":290}},{"h":2,"par":4,"hcp":2,"yards":{"Back":402,"Middle":369,"Senior":306,"Forward":298}},{"h":3,"par":4,"hcp":18,"yards":{"Back":301,"Middle":280,"Senior":280,"Forward":258}},{"h":4,"par":4,"hcp":14,"yards":{"Back":359,"Middle":313,"Senior":313,"Forward":260}},{"h":5,"par":3,"hcp":10,"yards":{"Back":158,"Middle":135,"Senior":135,"Forward":120}},{"h":6,"par":5,"hcp":2,"yards":{"Back":481,"Middle":462,"Senior":441,"Forward":405}},{"h":7,"par":4,"hcp":8,"yards":{"Back":362,"Middle":336,"Senior":305,"Forward":287}},{"h":8,"par":3,"hcp":6,"yards":{"Back":151,"Middle":133,"Senior":133,"Forward":107}},{"h":9,"par":4,"hcp":12,"yards":{"Back":353,"Middle":321,"Senior":321,"Forward":280}},{"h":10,"par":4,"hcp":17,"yards":{"Back":285,"Middle":261,"Senior":261,"Forward":230}},{"h":11,"par":4,"hcp":9,"yards":{"Back":398,"Middle":369,"Senior":369,"Forward":319}},{"h":12,"par":5,"hcp":7,"yards":{"Back":490,"Middle":466,"Senior":441,"Forward":404}},{"h":13,"par":4,"hcp":1,"yards":{"Back":430,"Middle":405,"Senior":380,"Forward":364}},{"h":14,"par":4,"hcp":13,"yards":{"Back":316,"Middle":284,"Senior":259,"Forward":232}},{"h":15,"par":3,"hcp":15,"yards":{"Back":167,"Middle":137,"Senior":137,"Forward":113}},{"h":16,"par":4,"hcp":3,"yards":{"Back":433,"Middle":408,"Senior":408,"Forward":372}},{"h":17,"par":3,"hcp":11,"yards":{"Back":176,"Middle":144,"Senior":144,"Forward":119}},{"h":18,"par":4,"hcp":5,"yards":{"Back":428,"Middle":396,"Senior":361,"Forward":350}}],"Rogers Park Golf Course":[{"h":1,"par":4,"hcp":13,"yards":{"Championship Blue":344,"Clifton White":315,"Club Green":315,"Forward Red":286}},{"h":2,"par":5,"hcp":5,"yards":{"Championship Blue":549,"Clifton White":519,"Club Green":503,"Forward Red":441}},{"h":3,"par":4,"hcp":3,"yards":{"Championship Blue":413,"Clifton White":383,"Club Green":357,"Forward Red":322}},{"h":4,"par":4,"hcp":15,"yards":{"Championship Blue":336,"Clifton White":310,"Club Green":306,"Forward Red":274}},{"h":5,"par":4,"hcp":9,"yards":{"Championship Blue":387,"Clifton White":352,"Club Green":349,"Forward Red":305}},{"h":6,"par":3,"hcp":17,"yards":{"Championship Blue":163,"Clifton White":147,"Club Green":139,"Forward Red":119}},{"h":7,"par":4,"hcp":7,"yards":{"Championship Blue":397,"Clifton White":371,"Club Green":367,"Forward Red":317}},{"h":8,"par":5,"hcp":1,"yards":{"Championship Blue":530,"Clifton White":485,"Club Green":467,"Forward Red":402}},{"h":9,"par":3,"hcp":11,"yards":{"Championship Blue":143,"Clifton White":124,"Club Green":115,"Forward Red":96}},{"h":10,"par":4,"hcp":2,"yards":{"Championship Blue":392,"Clifton White":357,"Club Green":347,"Forward Red":287}},{"h":11,"par":4,"hcp":10,"yards":{"Championship Blue":350,"Clifton White":320,"Club Green":308,"Forward Red":262}},{"h":12,"par":5,"hcp":6,"yards":{"Championship Blue":512,"Clifton White":476,"Club Green":456,"Forward Red":416}},{"h":13,"par":3,"hcp":16,"yards":{"Championship Blue":155,"Clifton White":133,"Club Green":127,"Forward Red":115}},{"h":14,"par":4,"hcp":4,"yards":{"Championship Blue":386,"Clifton White":348,"Club Green":339,"Forward Red":280}},{"h":15,"par":4,"hcp":18,"yards":{"Championship Blue":335,"Clifton White":311,"Club Green":295,"Forward Red":256}},{"h":16,"par":3,"hcp":14,"yards":{"Championship Blue":178,"Clifton White":152,"Club Green":141,"Forward Red":119}},{"h":17,"par":4,"hcp":8,"yards":{"Championship Blue":365,"Clifton White":329,"Club Green":314,"Forward Red":255}},{"h":18,"par":5,"hcp":12,"yards":{"Championship Blue":497,"Clifton White":464,"Club Green":450,"Forward Red":413}}],"Rocky Point Golf Course":[{"h":1,"par":3,"hcp":13,"yards":{"Blue":106,"White":93,"Red":86}},{"h":2,"par":4,"hcp":7,"yards":{"Blue":320,"White":302,"Red":272}},{"h":3,"par":4,"hcp":11,"yards":{"Blue":356,"White":337,"Red":290}},{"h":4,"par":3,"hcp":15,"yards":{"Blue":142,"White":127,"Red":109}},{"h":5,"par":5,"hcp":3,"yards":{"Blue":490,"White":463,"Red":413}},{"h":6,"par":4,"hcp":5,"yards":{"Blue":351,"White":314,"Red":270}},{"h":7,"par":4,"hcp":1,"yards":{"Blue":399,"White":372,"Red":319}},{"h":8,"par":3,"hcp":17,"yards":{"Blue":118,"White":106,"Red":88}},{"h":9,"par":4,"hcp":9,"yards":{"Blue":322,"White":301,"Red":256}},{"h":10,"par":5,"hcp":4,"yards":{"Blue":470,"White":444,"Red":408}},{"h":11,"par":4,"hcp":6,"yards":{"Blue":372,"White":358,"Red":312}},{"h":12,"par":4,"hcp":2,"yards":{"Blue":401,"White":369,"Red":319}},{"h":13,"par":3,"hcp":16,"yards":{"Blue":155,"White":140,"Red":112}},{"h":14,"par":4,"hcp":8,"yards":{"Blue":357,"White":332,"Red":280}},{"h":15,"par":4,"hcp":10,"yards":{"Blue":323,"White":307,"Red":260}},{"h":16,"par":4,"hcp":14,"yards":{"Blue":343,"White":315,"Red":278}},{"h":17,"par":3,"hcp":18,"yards":{"Blue":143,"White":124,"Red":107}},{"h":18,"par":4,"hcp":12,"yards":{"Blue":312,"White":290,"Red":244}}],"Bloomingdale Golfers Club":[{"h":1,"par":4,"hcp":9,"yards":{"Raccoon":385,"Blue":342,"Green":334,"White":316,"Silver":280,"Red":280}},{"h":2,"par":4,"hcp":3,"yards":{"Raccoon":435,"Blue":410,"Green":381,"White":367,"Silver":338,"Red":338}},{"h":3,"par":3,"hcp":13,"yards":{"Raccoon":226,"Blue":186,"Green":173,"White":166,"Silver":128,"Red":128}},{"h":4,"par":5,"hcp":1,"yards":{"Raccoon":564,"Blue":534,"Green":508,"White":483,"Silver":431,"Red":431}},{"h":5,"par":4,"hcp":7,"yards":{"Raccoon":412,"Blue":379,"Green":365,"White":346,"Silver":312,"Red":312}},{"h":6,"par":4,"hcp":5,"yards":{"Raccoon":439,"Blue":410,"Green":384,"White":357,"Silver":316,"Red":316}},{"h":7,"par":3,"hcp":17,"yards":{"Raccoon":197,"Blue":166,"Green":154,"White":147,"Silver":122,"Red":122}},{"h":8,"par":4,"hcp":15,"yards":{"Raccoon":443,"Blue":394,"Green":378,"White":357,"Silver":306,"Red":306}},{"h":9,"par":5,"hcp":11,"yards":{"Raccoon":546,"Blue":521,"Green":497,"White":476,"Silver":437,"Red":437}},{"h":10,"par":4,"hcp":2,"yards":{"Raccoon":433,"Blue":405,"Green":381,"White":363,"Silver":329,"Red":329}},{"h":11,"par":4,"hcp":12,"yards":{"Raccoon":385,"Blue":353,"Green":338,"White":325,"Silver":295,"Red":295}},{"h":12,"par":5,"hcp":8,"yards":{"Raccoon":524,"Blue":495,"Green":471,"White":451,"Silver":413,"Red":413}},{"h":13,"par":4,"hcp":14,"yards":{"Raccoon":392,"Blue":360,"Green":344,"White":325,"Silver":295,"Red":295}},{"h":14,"par":4,"hcp":4,"yards":{"Raccoon":398,"Blue":374,"Green":358,"White":343,"Silver":313,"Red":313}},{"h":15,"par":5,"hcp":6,"yards":{"Raccoon":547,"Blue":514,"Green":491,"White":462,"Silver":426,"Red":426}},{"h":16,"par":3,"hcp":18,"yards":{"Raccoon":184,"Blue":162,"Green":148,"White":139,"Silver":117,"Red":117}},{"h":17,"par":4,"hcp":10,"yards":{"Raccoon":388,"Blue":353,"Green":335,"White":318,"Silver":285,"Red":285}},{"h":18,"par":4,"hcp":16,"yards":{"Raccoon":409,"Blue":382,"Green":355,"White":342,"Silver":307,"Red":307}}],"Avila Golf & Country Club":[{"h":1,"par":4,"hcp":9,"yards":{"Gold":407,"Blue":372,"Member":372,"White":348,"Senior":340,"Red":296}},{"h":2,"par":4,"hcp":3,"yards":{"Gold":417,"Blue":389,"Member":389,"White":369,"Senior":359,"Red":318}},{"h":3,"par":3,"hcp":15,"yards":{"Gold":186,"Blue":153,"Member":153,"White":148,"Senior":136,"Red":119}},{"h":4,"par":4,"hcp":7,"yards":{"Gold":368,"Blue":341,"Member":341,"White":323,"Senior":312,"Red":272}},{"h":5,"par":5,"hcp":5,"yards":{"Gold":530,"Blue":505,"Member":505,"White":474,"Senior":455,"Red":400}},{"h":6,"par":3,"hcp":17,"yards":{"Gold":183,"Blue":167,"Member":167,"White":148,"Senior":134,"Red":118}},{"h":7,"par":5,"hcp":1,"yards":{"Gold":537,"Blue":510,"Member":510,"White":484,"Senior":468,"Red":419}},{"h":8,"par":4,"hcp":11,"yards":{"Gold":391,"Blue":360,"Member":360,"White":332,"Senior":314,"Red":272}},{"h":9,"par":4,"hcp":13,"yards":{"Gold":355,"Blue":327,"Member":327,"White":306,"Senior":295,"Red":249}},{"h":10,"par":4,"hcp":8,"yards":{"Gold":401,"Blue":370,"Member":370,"White":352,"Senior":341,"Red":281}},{"h":11,"par":4,"hcp":4,"yards":{"Gold":429,"Blue":406,"Member":406,"White":389,"Senior":364,"Red":302}},{"h":12,"par":3,"hcp":16,"yards":{"Gold":180,"Blue":161,"Member":161,"White":142,"Senior":133,"Red":113}},{"h":13,"par":4,"hcp":2,"yards":{"Gold":415,"Blue":392,"Member":392,"White":373,"Senior":358,"Red":307}},{"h":14,"par":4,"hcp":14,"yards":{"Gold":382,"Blue":345,"Member":345,"White":327,"Senior":317,"Red":268}},{"h":15,"par":3,"hcp":18,"yards":{"Gold":175,"Blue":153,"Member":153,"White":136,"Senior":127,"Red":107}},{"h":16,"par":4,"hcp":10,"yards":{"Gold":404,"Blue":381,"Member":381,"White":355,"Senior":337,"Red":290}},{"h":17,"par":5,"hcp":6,"yards":{"Gold":538,"Blue":502,"Member":502,"White":471,"Senior":451,"Red":406}},{"h":18,"par":4,"hcp":12,"yards":{"Gold":361,"Blue":335,"Member":335,"White":306,"Senior":291,"Red":261}}],"Cheval Golf & Country Club":[{"h":1,"par":4,"hcp":15,"yards":{"Black":350,"Blue":343,"White":329,"Silver":315,"Green":320,"Orange":310}},{"h":2,"par":4,"hcp":5,"yards":{"Black":387,"Blue":372,"White":349,"Silver":335,"Green":325,"Orange":301}},{"h":3,"par":3,"hcp":11,"yards":{"Black":190,"Blue":174,"White":161,"Silver":148,"Green":148,"Orange":130}},{"h":4,"par":4,"hcp":3,"yards":{"Black":420,"Blue":408,"White":384,"Silver":365,"Green":351,"Orange":339}},{"h":5,"par":5,"hcp":1,"yards":{"Black":540,"Blue":523,"White":497,"Silver":471,"Green":457,"Orange":421}},{"h":6,"par":4,"hcp":13,"yards":{"Black":368,"Blue":351,"White":333,"Silver":310,"Green":305,"Orange":280}},{"h":7,"par":3,"hcp":17,"yards":{"Black":185,"Blue":178,"White":164,"Silver":149,"Green":148,"Orange":120}},{"h":8,"par":5,"hcp":7,"yards":{"Black":540,"Blue":521,"White":495,"Silver":463,"Green":452,"Orange":416}},{"h":9,"par":4,"hcp":9,"yards":{"Black":380,"Blue":365,"White":343,"Silver":322,"Green":314,"Orange":292}},{"h":10,"par":4,"hcp":4,"yards":{"Black":418,"Blue":404,"White":388,"Silver":371,"Green":358,"Orange":334}},{"h":11,"par":4,"hcp":16,"yards":{"Black":347,"Blue":335,"White":320,"Silver":302,"Green":295,"Orange":274}},{"h":12,"par":3,"hcp":12,"yards":{"Black":200,"Blue":188,"White":170,"Silver":156,"Green":155,"Orange":137}},{"h":13,"par":5,"hcp":2,"yards":{"Black":548,"Blue":527,"White":501,"Silver":477,"Green":464,"Orange":427}},{"h":14,"par":4,"hcp":18,"yards":{"Black":349,"Blue":337,"White":319,"Silver":302,"Green":299,"Orange":277}},{"h":15,"par":4,"hcp":6,"yards":{"Black":401,"Blue":388,"White":371,"Silver":355,"Green":341,"Orange":310}},{"h":16,"par":3,"hcp":14,"yards":{"Black":188,"Blue":177,"White":156,"Silver":143,"Green":143,"Orange":121}},{"h":17,"par":4,"hcp":8,"yards":{"Black":398,"Blue":385,"White":365,"Silver":342,"Green":330,"Orange":308}},{"h":18,"par":5,"hcp":10,"yards":{"Black":521,"Blue":506,"White":484,"Silver":459,"Green":445,"Orange":412}}],"USF Claw Golf Course":[{"h":1,"par":4,"hcp":5,"yards":{"Gold":433,"Blue":386,"White":325,"Red":280}},{"h":2,"par":3,"hcp":17,"yards":{"Gold":210,"Blue":181,"White":152,"Red":123}},{"h":3,"par":4,"hcp":11,"yards":{"Gold":401,"Blue":362,"White":315,"Red":264}},{"h":4,"par":5,"hcp":3,"yards":{"Gold":537,"Blue":502,"White":467,"Red":419}},{"h":5,"par":4,"hcp":13,"yards":{"Gold":366,"Blue":338,"White":296,"Red":249}},{"h":6,"par":4,"hcp":7,"yards":{"Gold":400,"Blue":373,"White":327,"Red":278}},{"h":7,"par":3,"hcp":15,"yards":{"Gold":158,"Blue":137,"White":114,"Red":99}},{"h":8,"par":5,"hcp":1,"yards":{"Gold":537,"Blue":510,"White":466,"Red":413}},{"h":9,"par":4,"hcp":9,"yards":{"Gold":397,"Blue":372,"White":326,"Red":263}},{"h":10,"par":4,"hcp":8,"yards":{"Gold":382,"Blue":348,"White":296,"Red":254}},{"h":11,"par":3,"hcp":18,"yards":{"Gold":200,"Blue":170,"White":142,"Red":120}},{"h":12,"par":4,"hcp":2,"yards":{"Gold":440,"Blue":412,"White":370,"Red":305}},{"h":13,"par":4,"hcp":10,"yards":{"Gold":403,"Blue":372,"White":327,"Red":269}},{"h":14,"par":5,"hcp":4,"yards":{"Gold":535,"Blue":497,"White":454,"Red":399}},{"h":15,"par":4,"hcp":6,"yards":{"Gold":394,"Blue":360,"White":317,"Red":263}},{"h":16,"par":3,"hcp":16,"yards":{"Gold":187,"Blue":162,"White":131,"Red":115}},{"h":17,"par":4,"hcp":14,"yards":{"Gold":374,"Blue":346,"White":308,"Red":253}},{"h":18,"par":5,"hcp":12,"yards":{"Gold":521,"Blue":497,"White":453,"Red":390}}],"Tampa Palms Golf & Country Club":[{"h":1,"par":4,"hcp":15,"yards":{"Black":340,"Gold":316,"Blue":288,"White":260,"Green":229}},{"h":2,"par":4,"hcp":7,"yards":{"Black":378,"Gold":356,"Blue":325,"White":296,"Green":246}},{"h":3,"par":3,"hcp":13,"yards":{"Black":175,"Gold":154,"Blue":143,"White":130,"Green":112}},{"h":4,"par":5,"hcp":3,"yards":{"Black":503,"Gold":478,"Blue":442,"White":407,"Green":359}},{"h":5,"par":4,"hcp":9,"yards":{"Black":371,"Gold":351,"Blue":321,"White":292,"Green":246}},{"h":6,"par":3,"hcp":17,"yards":{"Black":165,"Gold":142,"Blue":131,"White":118,"Green":99}},{"h":7,"par":5,"hcp":1,"yards":{"Black":520,"Gold":496,"Blue":460,"White":424,"Green":380}},{"h":8,"par":4,"hcp":11,"yards":{"Black":352,"Gold":326,"Blue":300,"White":273,"Green":229}},{"h":9,"par":4,"hcp":5,"yards":{"Black":387,"Gold":368,"Blue":332,"White":307,"Green":255}},{"h":10,"par":5,"hcp":2,"yards":{"Black":508,"Gold":489,"Blue":460,"White":435,"Green":380}},{"h":11,"par":4,"hcp":14,"yards":{"Black":360,"Gold":340,"Blue":313,"White":289,"Green":241}},{"h":12,"par":3,"hcp":18,"yards":{"Black":178,"Gold":155,"Blue":146,"White":131,"Green":111}},{"h":13,"par":4,"hcp":10,"yards":{"Black":370,"Gold":351,"Blue":320,"White":294,"Green":248}},{"h":14,"par":4,"hcp":4,"yards":{"Black":398,"Gold":381,"Blue":350,"White":325,"Green":272}},{"h":15,"par":3,"hcp":16,"yards":{"Black":168,"Gold":149,"Blue":136,"White":121,"Green":100}},{"h":16,"par":4,"hcp":8,"yards":{"Black":356,"Gold":335,"Blue":308,"White":283,"Green":238}},{"h":17,"par":4,"hcp":6,"yards":{"Black":388,"Gold":367,"Blue":340,"White":310,"Green":264}},{"h":18,"par":5,"hcp":12,"yards":{"Black":497,"Gold":470,"Blue":433,"White":404,"Green":352}}],"Carrollwood Country Club":[{"h":1,"par":4,"hcp":11,"yards":{"Cypress/Meadow Blue":381,"Cypress/Meadow White":359,"Cypress/Meadow Silver":339,"Cypress/Meadow Teal":283,"Cypress/Meadow Red":236}},{"h":2,"par":3,"hcp":17,"yards":{"Cypress/Meadow Blue":176,"Cypress/Meadow White":163,"Cypress/Meadow Silver":149,"Cypress/Meadow Teal":110,"Cypress/Meadow Red":104}},{"h":3,"par":4,"hcp":5,"yards":{"Cypress/Meadow Blue":376,"Cypress/Meadow White":355,"Cypress/Meadow Silver":333,"Cypress/Meadow Teal":282,"Cypress/Meadow Red":254}},{"h":4,"par":5,"hcp":13,"yards":{"Cypress/Meadow Blue":508,"Cypress/Meadow White":481,"Cypress/Meadow Silver":452,"Cypress/Meadow Teal":395,"Cypress/Meadow Red":371}},{"h":5,"par":4,"hcp":3,"yards":{"Cypress/Meadow Blue":392,"Cypress/Meadow White":365,"Cypress/Meadow Silver":345,"Cypress/Meadow Teal":291,"Cypress/Meadow Red":254}},{"h":6,"par":4,"hcp":15,"yards":{"Cypress/Meadow Blue":329,"Cypress/Meadow White":307,"Cypress/Meadow Silver":289,"Cypress/Meadow Teal":247,"Cypress/Meadow Red":221}},{"h":7,"par":3,"hcp":9,"yards":{"Cypress/Meadow Blue":166,"Cypress/Meadow White":153,"Cypress/Meadow Silver":142,"Cypress/Meadow Teal":109,"Cypress/Meadow Red":99}},{"h":8,"par":4,"hcp":7,"yards":{"Cypress/Meadow Blue":364,"Cypress/Meadow White":341,"Cypress/Meadow Silver":320,"Cypress/Meadow Teal":273,"Cypress/Meadow Red":248}},{"h":9,"par":4,"hcp":1,"yards":{"Cypress/Meadow Blue":371,"Cypress/Meadow White":350,"Cypress/Meadow Silver":330,"Cypress/Meadow Teal":278,"Cypress/Meadow Red":249}},{"h":10,"par":4,"hcp":4,"yards":{"Cypress/Meadow Blue":385,"Cypress/Meadow White":364,"Cypress/Meadow Silver":343,"Cypress/Meadow Teal":301,"Cypress/Meadow Red":299}},{"h":11,"par":5,"hcp":10,"yards":{"Cypress/Meadow Blue":498,"Cypress/Meadow White":474,"Cypress/Meadow Silver":449,"Cypress/Meadow Teal":390,"Cypress/Meadow Red":373}},{"h":12,"par":4,"hcp":6,"yards":{"Cypress/Meadow Blue":378,"Cypress/Meadow White":352,"Cypress/Meadow Silver":330,"Cypress/Meadow Teal":278,"Cypress/Meadow Red":252}},{"h":13,"par":3,"hcp":18,"yards":{"Cypress/Meadow Blue":157,"Cypress/Meadow White":143,"Cypress/Meadow Silver":131,"Cypress/Meadow Teal":104,"Cypress/Meadow Red":91}},{"h":14,"par":4,"hcp":14,"yards":{"Cypress/Meadow Blue":348,"Cypress/Meadow White":327,"Cypress/Meadow Silver":307,"Cypress/Meadow Teal":254,"Cypress/Meadow Red":236}},{"h":15,"par":4,"hcp":12,"yards":{"Cypress/Meadow Blue":357,"Cypress/Meadow White":335,"Cypress/Meadow Silver":313,"Cypress/Meadow Teal":261,"Cypress/Meadow Red":241}},{"h":16,"par":3,"hcp":16,"yards":{"Cypress/Meadow Blue":174,"Cypress/Meadow White":155,"Cypress/Meadow Silver":138,"Cypress/Meadow Teal":108,"Cypress/Meadow Red":93}},{"h":17,"par":4,"hcp":2,"yards":{"Cypress/Meadow Blue":379,"Cypress/Meadow White":354,"Cypress/Meadow Silver":333,"Cypress/Meadow Teal":282,"Cypress/Meadow Red":257}},{"h":18,"par":5,"hcp":8,"yards":{"Cypress/Meadow Blue":517,"Cypress/Meadow White":492,"Cypress/Meadow Silver":466,"Cypress/Meadow Teal":407,"Cypress/Meadow Red":386}}],"Hunters Green Country Club":[{"h":1,"par":4,"hcp":13,"yards":{"Gold":323,"Blue":293,"White":281,"Green":233,"Red":228}},{"h":2,"par":4,"hcp":3,"yards":{"Gold":434,"Blue":410,"White":390,"Green":335,"Red":291}},{"h":3,"par":3,"hcp":9,"yards":{"Gold":211,"Blue":190,"White":175,"Green":150,"Red":141}},{"h":4,"par":5,"hcp":5,"yards":{"Gold":526,"Blue":497,"White":483,"Green":422,"Red":395}},{"h":5,"par":4,"hcp":15,"yards":{"Gold":385,"Blue":355,"White":339,"Green":287,"Red":267}},{"h":6,"par":3,"hcp":17,"yards":{"Gold":220,"Blue":197,"White":179,"Green":143,"Red":132}},{"h":7,"par":4,"hcp":7,"yards":{"Gold":395,"Blue":370,"White":355,"Green":300,"Red":270}},{"h":8,"par":4,"hcp":1,"yards":{"Gold":452,"Blue":425,"White":407,"Green":354,"Red":312}},{"h":9,"par":5,"hcp":11,"yards":{"Gold":545,"Blue":517,"White":498,"Green":431,"Red":399}},{"h":10,"par":4,"hcp":10,"yards":{"Gold":395,"Blue":373,"White":358,"Green":302,"Red":271}},{"h":11,"par":4,"hcp":4,"yards":{"Gold":418,"Blue":390,"White":373,"Green":316,"Red":284}},{"h":12,"par":3,"hcp":16,"yards":{"Gold":189,"Blue":170,"White":154,"Green":127,"Red":118}},{"h":13,"par":5,"hcp":2,"yards":{"Gold":533,"Blue":506,"White":486,"Green":421,"Red":392}},{"h":14,"par":4,"hcp":6,"yards":{"Gold":397,"Blue":373,"White":355,"Green":299,"Red":273}},{"h":15,"par":4,"hcp":14,"yards":{"Gold":379,"Blue":354,"White":335,"Green":280,"Red":259}},{"h":16,"par":3,"hcp":18,"yards":{"Gold":196,"Blue":174,"White":160,"Green":133,"Red":116}},{"h":17,"par":4,"hcp":8,"yards":{"Gold":391,"Blue":366,"White":348,"Green":289,"Red":265}},{"h":18,"par":4,"hcp":12,"yards":{"Gold":410,"Blue":380,"White":363,"Green":301,"Red":277}}],"Lexington Oaks Golf Club":[{"h":1,"par":4,"hcp":15,"yards":{"Black":387,"White":370,"Gold":305,"Jade":244}},{"h":2,"par":3,"hcp":17,"yards":{"Black":197,"White":180,"Gold":160,"Jade":133}},{"h":3,"par":5,"hcp":3,"yards":{"Black":539,"White":518,"Gold":441,"Jade":380}},{"h":4,"par":4,"hcp":11,"yards":{"Black":399,"White":384,"Gold":328,"Jade":268}},{"h":5,"par":4,"hcp":7,"yards":{"Black":422,"White":405,"Gold":348,"Jade":286}},{"h":6,"par":3,"hcp":13,"yards":{"Black":222,"White":208,"Gold":179,"Jade":140}},{"h":7,"par":4,"hcp":9,"yards":{"Black":376,"White":360,"Gold":309,"Jade":252}},{"h":8,"par":5,"hcp":1,"yards":{"Black":572,"White":547,"Gold":470,"Jade":406}},{"h":9,"par":4,"hcp":5,"yards":{"Black":413,"White":396,"Gold":337,"Jade":275}},{"h":10,"par":4,"hcp":10,"yards":{"Black":396,"White":376,"Gold":320,"Jade":260}},{"h":11,"par":4,"hcp":16,"yards":{"Black":341,"White":322,"Gold":278,"Jade":225}},{"h":12,"par":3,"hcp":18,"yards":{"Black":182,"White":167,"Gold":143,"Jade":118}},{"h":13,"par":5,"hcp":4,"yards":{"Black":552,"White":527,"Gold":453,"Jade":392}},{"h":14,"par":4,"hcp":6,"yards":{"Black":402,"White":381,"Gold":328,"Jade":266}},{"h":15,"par":3,"hcp":14,"yards":{"Black":209,"White":193,"Gold":167,"Jade":133}},{"h":16,"par":4,"hcp":8,"yards":{"Black":399,"White":381,"Gold":329,"Jade":266}},{"h":17,"par":4,"hcp":12,"yards":{"Black":369,"White":351,"Gold":300,"Jade":240}},{"h":18,"par":4,"hcp":2,"yards":{"Black":426,"White":406,"Gold":347,"Jade":283}}],"Temple Terrace Golf & Country Club":[{"h":1,"par":4,"hcp":11,"yards":{"Blue":378,"White":360,"Green":319,"Red":319}},{"h":2,"par":4,"hcp":5,"yards":{"Blue":393,"White":373,"Green":332,"Red":293}},{"h":3,"par":4,"hcp":13,"yards":{"Blue":349,"White":330,"Green":292,"Red":260}},{"h":4,"par":5,"hcp":1,"yards":{"Blue":519,"White":497,"Green":448,"Red":411}},{"h":5,"par":3,"hcp":17,"yards":{"Blue":175,"White":162,"Green":144,"Red":127}},{"h":6,"par":4,"hcp":9,"yards":{"Blue":377,"White":360,"Green":321,"Red":283}},{"h":7,"par":3,"hcp":15,"yards":{"Blue":177,"White":163,"Green":143,"Red":127}},{"h":8,"par":4,"hcp":7,"yards":{"Blue":384,"White":369,"Green":332,"Red":296}},{"h":9,"par":5,"hcp":3,"yards":{"Blue":484,"White":463,"Green":419,"Red":388}},{"h":10,"par":4,"hcp":2,"yards":{"Blue":410,"White":393,"Green":354,"Red":315}},{"h":11,"par":4,"hcp":10,"yards":{"Blue":358,"White":341,"Green":299,"Red":263}},{"h":12,"par":3,"hcp":16,"yards":{"Blue":158,"White":146,"Green":129,"Red":108}},{"h":13,"par":4,"hcp":6,"yards":{"Blue":388,"White":372,"Green":335,"Red":293}},{"h":14,"par":4,"hcp":12,"yards":{"Blue":374,"White":357,"Green":319,"Red":279}},{"h":15,"par":5,"hcp":4,"yards":{"Blue":499,"White":481,"Green":436,"Red":405}},{"h":16,"par":3,"hcp":18,"yards":{"Blue":164,"White":150,"Green":131,"Red":113}},{"h":17,"par":4,"hcp":8,"yards":{"Blue":368,"White":351,"Green":316,"Red":280}},{"h":18,"par":4,"hcp":14,"yards":{"Blue":362,"White":342,"Green":301,"Red":265}}],"Heritage Isles Golf & Country Club":[{"h":1,"par":4,"hcp":7,"yards":{"Gold":424,"Blue":382,"White":370,"Black":382,"Green":372,"Red":309}},{"h":2,"par":3,"hcp":17,"yards":{"Gold":199,"Blue":181,"White":171,"Black":170,"Green":152,"Red":126}},{"h":3,"par":5,"hcp":5,"yards":{"Gold":546,"Blue":502,"White":474,"Black":488,"Green":442,"Red":406}},{"h":4,"par":4,"hcp":11,"yards":{"Gold":399,"Blue":363,"White":348,"Black":355,"Green":331,"Red":291}},{"h":5,"par":4,"hcp":1,"yards":{"Gold":437,"Blue":410,"White":397,"Black":398,"Green":376,"Red":325}},{"h":6,"par":3,"hcp":15,"yards":{"Gold":203,"Blue":176,"White":160,"Black":166,"Green":149,"Red":124}},{"h":7,"par":5,"hcp":3,"yards":{"Gold":559,"Blue":524,"White":506,"Black":520,"Green":482,"Red":433}},{"h":8,"par":4,"hcp":13,"yards":{"Gold":371,"Blue":344,"White":333,"Black":339,"Green":319,"Red":267}},{"h":9,"par":4,"hcp":9,"yards":{"Gold":400,"Blue":379,"White":366,"Black":369,"Green":348,"Red":296}},{"h":10,"par":4,"hcp":10,"yards":{"Gold":400,"Blue":376,"White":363,"Black":366,"Green":344,"Red":290}},{"h":11,"par":4,"hcp":2,"yards":{"Gold":429,"Blue":406,"White":390,"Black":404,"Green":380,"Red":323}},{"h":12,"par":5,"hcp":12,"yards":{"Gold":521,"Blue":495,"White":477,"Black":487,"Green":454,"Red":405}},{"h":13,"par":3,"hcp":18,"yards":{"Gold":198,"Blue":170,"White":156,"Black":161,"Green":146,"Red":120}},{"h":14,"par":4,"hcp":6,"yards":{"Gold":406,"Blue":385,"White":370,"Black":378,"Green":356,"Red":303}},{"h":15,"par":4,"hcp":4,"yards":{"Gold":430,"Blue":408,"White":392,"Black":399,"Green":377,"Red":319}},{"h":16,"par":3,"hcp":16,"yards":{"Gold":199,"Blue":177,"White":163,"Black":165,"Green":151,"Red":125}},{"h":17,"par":4,"hcp":14,"yards":{"Gold":380,"Blue":356,"White":341,"Black":347,"Green":325,"Red":271}},{"h":18,"par":5,"hcp":8,"yards":{"Gold":576,"Blue":548,"White":531,"Black":540,"Green":513,"Red":455}}],"Saddlebrook Resort":[{"h":1,"par":4,"hcp":12,"yards":{"Gold":346,"Blue":321,"White":307,"Green":301,"Red":284}},{"h":2,"par":5,"hcp":4,"yards":{"Gold":553,"Blue":492,"White":479,"Green":420,"Red":402}},{"h":3,"par":4,"hcp":8,"yards":{"Gold":430,"Blue":395,"White":383,"Green":312,"Red":307}},{"h":4,"par":4,"hcp":6,"yards":{"Gold":439,"Blue":395,"White":382,"Green":334,"Red":324}},{"h":5,"par":3,"hcp":18,"yards":{"Gold":199,"Blue":174,"White":144,"Green":136,"Red":130}},{"h":6,"par":4,"hcp":10,"yards":{"Gold":348,"Blue":312,"White":300,"Green":247,"Red":242}},{"h":7,"par":5,"hcp":2,"yards":{"Gold":558,"Blue":514,"White":448,"Green":421,"Red":405}},{"h":8,"par":3,"hcp":16,"yards":{"Gold":212,"Blue":187,"White":136,"Green":122,"Red":115}},{"h":9,"par":4,"hcp":14,"yards":{"Gold":334,"Blue":312,"White":303,"Green":260,"Red":252}},{"h":10,"par":4,"hcp":7,"yards":{"Gold":422,"Blue":389,"White":302,"Green":298,"Red":292}},{"h":11,"par":5,"hcp":1,"yards":{"Gold":563,"Blue":481,"White":465,"Green":427,"Red":418}},{"h":12,"par":4,"hcp":11,"yards":{"Gold":381,"Blue":362,"White":261,"Green":225,"Red":218}},{"h":13,"par":3,"hcp":15,"yards":{"Gold":235,"Blue":192,"White":146,"Green":136,"Red":123}},{"h":14,"par":4,"hcp":5,"yards":{"Gold":430,"Blue":397,"White":365,"Green":289,"Red":274}},{"h":15,"par":5,"hcp":3,"yards":{"Gold":548,"Blue":504,"White":467,"Green":420,"Red":410}},{"h":16,"par":3,"hcp":17,"yards":{"Gold":249,"Blue":195,"White":146,"Green":138,"Red":129}},{"h":17,"par":4,"hcp":13,"yards":{"Gold":330,"Blue":288,"White":271,"Green":262,"Red":232}},{"h":18,"par":4,"hcp":9,"yards":{"Gold":399,"Blue":326,"White":310,"Green":285,"Red":275}}]};

function _lookupScorecard(courseName) {
  if (!courseName) return null;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const n = norm(courseName);
  // Exact key match first
  for (const [k,v] of Object.entries(COURSE_SCORECARDS)) {
    if (norm(k) === n) return {name:k, holes:v};
  }
  // Partial match — course name contains key or key contains course name
  for (const [k,v] of Object.entries(COURSE_SCORECARDS)) {
    const kn = norm(k);
    if (n.includes(kn) || kn.includes(n)) return {name:k, holes:v};
  }
  // Word overlap — at least 2 significant words match
  const words = n => n.replace(/golf|country|club|course|resort|&/g,'').split(/\W+/).filter(w=>w.length>3);
  const qWords = new Set(words(n));
  let best = null, bestScore = 0;
  for (const [k,v] of Object.entries(COURSE_SCORECARDS)) {
    const score = words(norm(k)).filter(w=>qWords.has(w)).length;
    if (score > bestScore) { bestScore=score; best={name:k,holes:v}; }
  }
  return bestScore >= 1 ? best : null;
}

// ── Convert local scorecard → Ryze API format ────────────────
function _scorecardToRyzeFormat(name, holes) {
  if (!holes?.length) return null;
  // Get all tee names from the first hole
  const teeNames = Object.keys(holes[0].yards || {});
  const teeBoxes = teeNames.map(tee => ({
    tee,
    slope: null,
    handicap: null,
    yards: holes.reduce((s,h) => s + (h.yards?.[tee]||0), 0),
  }));
  const scorecard = holes.map(h => ({
    Hole: h.h,
    Par: h.par,
    Handicap: h.hcp,
    tees: Object.fromEntries(
      teeNames.map((tee,i) => [`teeBox${i+1}`, {color:tee, yards:h.yards?.[tee]||0}])
    ),
  }));
  return { name, scorecard, teeBoxes, _source: 'local' };
}

// ── Convert GolfCourseAPI.com → Ryze API format ───────────────
function _gcapiToRyzeFormat(course) {
  if (!course) return null;
  const allTees = [...(course.tees?.male||[]), ...(course.tees?.female||[])];
  const teeBoxes = allTees.map(t => ({
    tee: t.tee_name,
    slope: t.slope_rating,
    handicap: t.course_rating,
    yards: t.holes?.reduce((s,h)=>s+(h.yardage||0),0) || 0,
  }));
  const t0 = allTees[0];
  const scorecard = (t0?.holes||[]).map((h,i) => ({
    Hole: i+1,
    Par: h.par,
    Handicap: h.handicap || null,
    tees: Object.fromEntries(
      allTees.map((t,ti) => [`teeBox${ti+1}`, {color:t.tee_name, yards:t.holes?.[i]?.yardage||0}])
    ),
  }));
  return { name: course.course_name, scorecard, teeBoxes, _source: 'gcapi' };
}

// ── Scrape foretee.com scorecard for any US golf course ─────
// Called as last-resort when course not in local data + GolfCourseAPI fails
async function _scrapeForeteeScorecard(courseName) {
  // Build foretee search URL
  const searchUrl = `https://foretee.com/search?q=${encodeURIComponent(courseName)}&type=course`;
  try {
    // We can't fetch cross-origin directly — use the server proxy
    const proxyUrl = `/api/foretee-scorecard?name=${encodeURIComponent(courseName)}`;
    const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (resp.ok) {
      const data = await resp.json();
      if (data?.holes?.length >= 9) return data;
    }
  } catch(_) {}
  return null;
}

// ── Auto-lookup city when ZIP is entered ──────────────────────
window.handleZipInput = async function(prefix) {
  const zipEl  = document.getElementById(prefix + '-zip');
  const cityEl = document.getElementById(prefix + '-city');
  const stateEl= document.getElementById(prefix + '-state');
  const zip = zipEl?.value?.trim();
  if (!zip || zip.length < 5) return;
  // Debounce: only fire when 5 digits typed
  if (!/^\d{5}$/.test(zip)) return;
  try {
    const gd = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+zip+'&count=5&language=en&format=json&country_code=US')).json();
    const best = gd.results?.find(r=>r.country_code==='US') || gd.results?.[0];
    if (best) {
      if (cityEl && !cityEl.value) cityEl.value = best.name || '';
      if (stateEl && !stateEl.value) {
        const STATE_ABBR = {Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',Delaware:'DE',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV',"New Hampshire":'NH',"New Jersey":'NJ',"New Mexico":'NM',"New York":'NY',"North Carolina":'NC',"North Dakota":'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA',"Rhode Island":'RI',"South Carolina":'SC',"South Dakota":'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA',"West Virginia":'WV',Wisconsin:'WI',Wyoming:'WY',"District of Columbia":'DC'};
        stateEl.value = STATE_ABBR[best.admin1] || '';
      }
    }
  } catch(_) {}
};

window.UI = {

  // ── Navigation ──
  goScreen(name) {
    // Sanitize — only allow known screen names
    const VALID_SCREENS = ["feed","players","search","scorecard","profile","edit-profile",
      "vibes","messages","conversation","my-activity","auth","onboard","notifications","player-profile","course-layout"];
    if(name && !VALID_SCREENS.includes(name)) { console.warn("Invalid screen:", name); return; }
    goScreen(name);
    if (name === "scorecard") {
      buildGamePanel();
      buildScoreTable();
      loadRoundHistory();
      // ── GPS Panel ────────────────────────────────────────
      if (!document.getElementById('gps-panel')) {
        const scScreen = document.getElementById('screen-scorecard');
        const insertBefore = document.getElementById('sc-course-input')?.closest('.sc-hero, div');
        const gpsPanel = document.createElement('div');
        gpsPanel.id = 'gps-panel';
        gpsPanel.style.cssText = 'margin:0 16px 14px;border-radius:16px;border:1.5px solid var(--border);background:var(--surface);overflow:hidden';
        gpsPanel.innerHTML = `
          <!-- Collapsed header — always visible -->
          <div id="gps-header" onclick="document.getElementById('gps-body').style.display=document.getElementById('gps-body').style.display==='none'?'block':'none'"
            style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;cursor:pointer">
            <div style="display:flex;align-items:center;gap:8px">
              <span id="gps-status-dot" style="width:10px;height:10px;border-radius:50%;background:var(--border);display:inline-block"></span>
              <span style="font-size:13px;font-weight:600;color:var(--text)">📡 GPS Tracker</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span id="gps-hole" style="font-size:12px;color:var(--muted)">Hole 1</span>
              <span id="gps-dist" style="font-size:14px;font-weight:700;color:var(--green)">—</span>
            </div>
          </div>
          <!-- Expanded body -->
          <div id="gps-body" style="display:none;border-top:0.5px solid var(--border)">
            <!-- Live stats row -->
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0">
              <div style="text-align:center;padding:14px 8px;border-right:0.5px solid var(--border)">
                <div id="gps-dist-big" style="font-size:28px;font-weight:700;color:var(--green)">—</div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">To Pin</div>
              </div>
              <div style="text-align:center;padding:14px 8px;border-right:0.5px solid var(--border)">
                <div id="gps-hole-big" style="font-size:28px;font-weight:700;color:var(--text)">1</div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">Hole</div>
              </div>
              <div style="text-align:center;padding:14px 8px">
                <div id="gps-acc" style="font-size:20px;font-weight:600;color:var(--muted)">—</div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">Accuracy</div>
              </div>
            </div>
            <!-- Action buttons -->
            <div style="display:flex;gap:8px;padding:10px 12px;border-top:0.5px solid var(--border)">
              <button id="gps-start-btn" onclick="safeUI('startGpsTracking')"
                style="flex:1;padding:10px;border-radius:12px;border:none;background:var(--green);color:#fff;
                  font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
                ▶ Start
              </button>
              <button onclick="safeUI('logGpsShot')"
                style="flex:1;padding:10px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg);
                  color:var(--text);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
                🏌️ Shot
              </button>
              <button onclick="safeUI('prevGpsHole')"
                style="padding:10px 14px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg);
                  color:var(--text);font-size:13px;cursor:pointer;font-family:inherit">◀</button>
              <button onclick="safeUI('nextGpsHole')"
                style="padding:10px 14px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg);
                  color:var(--text);font-size:13px;cursor:pointer;font-family:inherit">▶</button>
              <button onclick="safeUI('openCourseLayoutScreen')"
                style="padding:10px 12px;border-radius:12px;border:1.5px solid var(--green);background:var(--green-light);
                  color:var(--green-dark);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">🗺️ Map</button>
            </div>
            <!-- Shot history strip -->
            <div id="gps-shots-strip"
              style="display:flex;gap:6px;overflow-x:auto;padding:8px 12px;border-top:0.5px solid var(--border);min-height:36px;scrollbar-width:none">
              <span style="font-size:12px;color:var(--muted);align-self:center">No shots logged yet</span>
            </div>
          </div>`;
        // Insert before the game-panel div
        const gamePanel = document.getElementById('game-panel');
        if (gamePanel) gamePanel.parentNode.insertBefore(gpsPanel, gamePanel);
        else if (scScreen) scScreen.insertBefore(gpsPanel, scScreen.firstChild);
      }
      // Wire course input autocomplete (same as edit-profile)
      const scCourseInp = document.getElementById('sc-course-input');
      if (scCourseInp && !scCourseInp.dataset.acWired) {
        scCourseInp.dataset.acWired = '1';
        scCourseInp.setAttribute('autocomplete','off');
        scCourseInp.style.background = '#ffffff';
        scCourseInp.style.color = '#1a1a1a';
        scCourseInp.style.border = '1.5px solid #d1d5db';
        scCourseInp.style.borderRadius = '10px';
        scCourseInp.style.padding = '10px 12px';
        scCourseInp.style.fontFamily = 'inherit';
        scCourseInp.style.fontSize = '14px';
        scCourseInp.style.width = '100%';
        scCourseInp.style.boxSizing = 'border-box';
        scCourseInp.onfocus = () => { scCourseInp.style.border = '1.5px solid #16a34a'; scCourseInp.style.outline = 'none'; };
        scCourseInp.onblur = () => { scCourseInp.style.border = '1.5px solid #d1d5db'; };
        const scAcId = 'sc-course-ac';
        let scAc = document.getElementById(scAcId);
        if (!scAc) {
          scAc = document.createElement('div');
          scAc.id = scAcId;
          scAc.style.cssText = [
            'position:absolute','z-index:300','background:#ffffff',
            'border:1.5px solid var(--green)','border-radius:12px',
            'box-shadow:0 8px 24px rgba(0,0,0,.18)','max-height:220px',
            'overflow-y:auto','width:100%','left:0','top:calc(100% + 4px)','display:none'
          ].join(';');
          const wrap = scCourseInp.parentNode;
          if (wrap) { wrap.style.position='relative'; wrap.appendChild(scAc); }
        }
        const showScAc = () => {
          const q = scCourseInp.value.toLowerCase().trim();
          const courses = window._nearbyCourses || [];
          // Also include myProfile.homeCourse and known static courses as fallback
          const extras = [
            window.myProfile?.homeCourse,
            'Heritage Harbor Golf & Country Club',
            'TPC Tampa Bay','Northdale Golf & Tennis Club',
            'Babe Zaharias Golf Course','Rogers Park Golf Course',
            'Rocky Point Golf Course','Plantation Palms Golf Club',
            'Avila Golf & Country Club','Cheval Golf & Country Club'
          ].filter(Boolean).map(name=>({name}));
          const allCourses = courses.length ? courses : extras;
          const matches = q.length < 1
            ? allCourses.slice(0,8)
            : allCourses.filter(c=>(c.name||'').toLowerCase().includes(q)).slice(0,8);
          if (!matches.length) { scAc.style.display='none'; return; }
          scAc.innerHTML = matches.map(c => {
            const safeName = esc(c.name||'');
            const dist = c.dist ? ` <span style="font-size:11px;color:var(--muted)">${c.dist.toFixed(1)} mi</span>` : '';
            return `<div style="padding:11px 14px;cursor:pointer;font-size:14px;font-weight:500;color:#1a1a1a;
                background:#ffffff;border-bottom:0.5px solid #e5e7eb"
              onmouseover="this.style.background='#f0fdf4';this.style.color='#166534'"
              onmouseout="this.style.background='#ffffff';this.style.color='#1a1a1a'"
              onmousedown="document.getElementById('sc-course-input').value='${safeName}';document.getElementById('${scAcId}').style.display='none';event.preventDefault()">
              ⛳ ${safeName}${dist}
            </div>`;
          }).join('');
          scAc.style.display = 'block';
        };
        scCourseInp.addEventListener('input', showScAc);
        scCourseInp.addEventListener('focus', showScAc);
        scCourseInp.addEventListener('blur', () => setTimeout(()=>{ if(scAc) scAc.style.display='none'; }, 200));
        // Pre-fill with user's home course if field is empty
        if (!scCourseInp.value && window.myProfile?.homeCourse) {
          scCourseInp.value = window.myProfile.homeCourse;
        }
      }
      const dateInput = document.getElementById("sc-round-date");
      const timeInput = document.getElementById("sc-round-time");
      if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split("T")[0];
      if (timeInput && !timeInput.value) timeInput.value = "08:00";
      UI.loadScorecardWeather();
    }
    if (name === "players") {
      // Inject vibe + location filter dropdowns if not present
      const pList = document.getElementById('players-list-main');
      if (pList && !document.getElementById('players-vibe-bar')) {
        const ALL_VIBES = ['Competitive','Casual','Drinker','Sober','420 Friendly','Music on Cart',
          'Fast Pace','Walker','Cart Only','Early Bird','Twilight','Social Poster','Low Key',
          'Score Keeper','Course Explorer'];
        // Build unique city list from allPlayers for location filter
        const cities = [...new Set((allPlayers||[]).map(p=>(p.city||'').split(',')[0].trim()).filter(Boolean))].sort();
        const pbar = document.createElement('div');
        pbar.id = 'players-vibe-bar';
        pbar.style.cssText = 'display:flex;gap:10px;padding:10px 16px 10px;border-bottom:0.5px solid var(--border);';
        pbar.innerHTML = `
          <select id="player-vibe-select"
            onchange="window._playerVibeFilter=this.value;safeUI('applyPlayerFilters')"
            style="flex:1;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);
              background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;
              cursor:pointer;outline:none;appearance:none;
              background-image:url('data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\'><path d=\'M1 1l5 5 5-5\' fill=\'none\' stroke=\'%23888\' stroke-width=\'1.5\'/></svg>');
              background-repeat:no-repeat;background-position:right 10px center;padding-right:28px">
            <option value="all">🏌️ All Vibes</option>
            ${ALL_VIBES.map(v=>`<option value="${v}">${v}</option>`).join('')}
          </select>
          <select id="player-loc-select"
            onchange="window._playerMilesFilter=this.value;safeUI('applyPlayerFilters')"
            style="flex:1;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);
              background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;
              cursor:pointer;outline:none;appearance:none;
              background-image:url('data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\'><path d=\'M1 1l5 5 5-5\' fill=\'none\' stroke=\'%23888\' stroke-width=\'1.5\'/></svg>');
              background-repeat:no-repeat;background-position:right 10px center;padding-right:28px">
            <option value="all">📍 Any distance</option>
            <option value="5">Within 5 miles</option>
            <option value="10">Within 10 miles</option>
            <option value="25">Within 25 miles</option>
            <option value="50">Within 50 miles</option>
          </select>
        `;
        pList.parentNode.insertBefore(pbar, pList);
      }
      window._playerVibeFilter  = 'all';
      window._playerMilesFilter = 'all';
    }
    if (name === "profile") {
      updateProfileUI(); UI.loadProfileActivity();
      // Inject account-management section (with brief delay to let screen render)
      setTimeout(() => {
      if (!document.getElementById('profile-account-section')) {
        const profileScreen = document.getElementById('screen-profile');
        if (profileScreen) {
          const sec = document.createElement('div');
          sec.id = 'profile-account-section';
          sec.style.cssText = 'padding:20px 16px 40px;border-top:0.5px solid var(--border);margin-top:8px';
          sec.innerHTML = `
            <div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:14px">Account</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <button onclick="safeUI('showSubscriptionManager')"
                style="width:100%;padding:13px 16px;border-radius:14px;border:1.5px solid var(--border);
                  background:var(--surface);color:var(--text);font-size:14px;font-weight:500;
                  cursor:pointer;font-family:inherit;text-align:left;display:flex;align-items:center;justify-content:space-between">
                <span>⭐ Subscription Plan</span>
                <span id="profile-plan-badge" style="font-size:12px;color:var(--green);font-weight:600">Free</span>
              </button>
              <button onclick="safeUI('confirmDeleteAccount')"
                style="width:100%;padding:13px 16px;border-radius:14px;border:1.5px solid #ef4444;
                  background:transparent;color:#ef4444;font-size:14px;font-weight:500;
                  cursor:pointer;font-family:inherit;text-align:left">
                🗑️ Delete Account
              </button>
            </div>`;
          profileScreen.appendChild(sec);
        }
      }
      }, 100); // end setTimeout
      // Update plan badge (also deferred)
      setTimeout(() => {
      const badge = document.getElementById('profile-plan-badge');
      if (badge) badge.textContent = myProfile.plan === 'pro' ? '⭐ Pro' : myProfile.plan === 'team' ? '👥 Team' : 'Free';
      }, 150); // end plan badge setTimeout
    }
    if (name === "notifications") { updateProfileUI(); loadNotificationsScreen(); }
    if (name === "onboard")       { buildOnboardScreen(); }
    if (name === "auth")          { buildAuthScreen(); }
    if (name === "feed") {
      updateProfileUI(); UI.refreshWeather(); startLocationWatch();
      // Tee times moved to Discover tab only
    }
    if (name === "search") {
      // Always resync location when entering Discover
      const _profileCity = myProfile.city || '';
      const _geoKey = _profileCity ? 'geo_'+_profileCity.toLowerCase().replace(/[^a-z0-9]/g,'_') : '';
      const _geoCached = _geoKey ? (() => { try { const c=sessionStorage.getItem(_geoKey); if(c){const p=JSON.parse(c); if(p.ts&&Date.now()-p.ts<86400000) return p;} } catch(_){} return null; })() : null;
      // If profile city changed OR we have no coords but do have a geo cache for this city
      const _cityChanged = _profileCity && _profileCity !== window._lastDiscoverCity;
      const _hasNoCoords = !window._wxLat && _geoCached;
      const _hasNoCourses = !window._nearbyCourses?.length && !window._coursesLoading;
      if (_cityChanged || _hasNoCoords || _hasNoCourses) {
        if (_cityChanged) {
          window._lastDiscoverCity = _profileCity;
          // Use saved lat/lon from profile if available, otherwise null for re-geocode
          if (myProfile.lat && myProfile.lon) {
            window._wxLat = myProfile.lat;
            window._wxLon = myProfile.lon;
          } else {
            window._wxLat = null; window._wxLon = null;
          }
          try { Object.keys(sessionStorage).filter(k=>k.startsWith('gc2_')||k.startsWith('gc_')).forEach(k=>sessionStorage.removeItem(k)); } catch(_) {}
          window._nearbyCourses = null; window._coursesLoading = false;
        }
        // Restore coords from geo cache if available
        if (_geoCached && !window._wxLat) { window._wxLat = _geoCached.lat; window._wxLon = _geoCached.lon; }
        // Clear the courses array so stale courses don't show during reload
        window._nearbyCourses = [];
        // Always trigger a fresh course load when city changed or coords restored
        setTimeout(() => { window._coursesLoading = false; UI.loadNearbyCourses(); }, 80);
      }
      updateProfileUI();
      const currentCity = window._weatherCity || '';
      if (window._lastCourseCity && window._lastCourseCity !== currentCity) {
        try { Object.keys(sessionStorage).filter(k=>k.startsWith('gc_')).forEach(k=>sessionStorage.removeItem(k)); } catch(_){}
        window._nearbyCourses = null;
        window._coursesLoading = false;
      }
      window._lastCourseCity = currentCity;
      // Inject tee times section into Discover tee times tab
      const teesEl = document.getElementById('all-tee-times');
      if (teesEl && !document.getElementById('disc-nearby-teetimes')) {
        const teeNearby = document.createElement('div');
        teeNearby.id = 'disc-nearby-teetimes';
        teeNearby.style.cssText = 'padding:12px 0 0';
        // Time filter header
        const hdr = document.createElement('div');
        hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0 0 10px;flex-wrap:wrap;gap:8px';
        hdr.innerHTML = `<div style="font-size:13px;font-weight:700;color:var(--text)">⛳ Available Tee Times</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${[['all','Any time'],['7','7AM'],['8','8AM'],['9','9AM'],['10','10AM'],['11','11AM'],['12','Noon'],['13','1PM+']].map(([v,l],i)=>
              `<button class="disc-time-pill${i===0?' disc-time-active':''}" data-hour="${v}"
                onclick="document.querySelectorAll('.disc-time-pill').forEach(b=>b.classList.remove('disc-time-active'));this.classList.add('disc-time-active');window._teeSectionFilter='${v}';loadDiscoverTeeTimes&&loadDiscoverTeeTimes()"
                style="padding:4px 10px;border-radius:14px;font-size:11px;font-weight:500;cursor:pointer;
                  border:1px solid ${i===0?'var(--green)':'var(--border)'};
                  background:${i===0?'var(--green-light)':'var(--surface)'};
                  color:${i===0?'var(--green-dark)':'var(--text)'};font-family:inherit;transition:all .15s">
                ${l}
              </button>`
            ).join('')}
          </div>`;
        teeNearby.appendChild(hdr);
        const nearbyList = document.createElement('div');
        nearbyList.id = 'disc-tee-nearby-list';
        nearbyList.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">Loading nearby tee times…</div>';
        teeNearby.appendChild(nearbyList);
        teesEl.parentNode.insertBefore(teeNearby, teesEl);
        // Style active disc pill
        const style = document.createElement('style');
        style.textContent = '.disc-time-pill.disc-time-active{background:var(--green-light)!important;color:var(--green-dark)!important;border-color:var(--green)!important}';
        document.head.appendChild(style);
      }
      setTimeout(loadDiscoverTeeTimes, 800);
      // Inject distance filter dropdown if not already there
      const coursesList = document.getElementById('courses-list');
      if (coursesList && !document.getElementById('dist-filter-bar')) {
        const bar = document.createElement('div');
        bar.id = 'dist-filter-bar';
        bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 16px 8px;';
        bar.innerHTML = `
          <label for="dist-filter" style="font-size:12px;font-weight:600;color:var(--muted);white-space:nowrap;text-transform:uppercase;letter-spacing:.5px">📍 Within</label>
          <select id="dist-filter"
            
            style="flex:1;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);
              background:var(--surface);color:var(--text);font-size:14px;font-weight:500;
              font-family:inherit;cursor:pointer;outline:none;appearance:none;
              background-image:url('data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\'><path d=\'M1 1l5 5 5-5\' fill=\'none\' stroke=\'%23888\' stroke-width=\'1.5\'/></svg>');
              background-repeat:no-repeat;background-position:right 12px center;padding-right:32px">
            <option value="5">5 miles</option>
            <option value="10">10 miles</option>
            <option value="25" selected>25 miles</option>
            <option value="50">50 miles</option>
            <option value="75">75 miles</option>
            <option value="100">100 miles (max)</option>
          </select>
        `;
        coursesList.parentNode.insertBefore(bar, coursesList);
        const _dfSel = document.getElementById('dist-filter');
        if (_dfSel) {
          _dfSel.addEventListener('change', function() {
            const newMi  = parseFloat(this.value || 25);
            const lastMi = window._lastFetchedMiles || 0;
            const _lbl = document.getElementById('courses-radius-label');
            const _lst = document.getElementById('courses-list');
            if (newMi !== lastMi) {
              window._nearbyCourses = null;
              window._coursesLoading = false;
              if (_lbl) _lbl.textContent = 'Searching within ' + newMi + ' mi…';
              if (_lst) _lst.innerHTML = '<div style="padding:40px 16px;text-align:center;color:var(--muted)">⛳ Finding courses…</div>';
              try{Object.keys(sessionStorage).filter(k=>k.startsWith('gc_')).forEach(k=>sessionStorage.removeItem(k));Object.keys(localStorage).filter(k=>k.startsWith('fw_gc_')).forEach(k=>localStorage.removeItem(k));}catch(_){}
              UI.loadNearbyCourses();
            } else {
              UI.filterCourses(document.getElementById('course-search-input')?.value || '');
            }
          });
        }
      }
      UI.loadNearbyCourses();
    }
    if (name === "edit-profile") UI.goToEditProfile();
    if (name === "messages") {
      updateProfileUI(); UI.loadConversations();
      // Inject group messaging header if not already there
      const convList = document.getElementById('conversations-list');
      if (convList && !document.getElementById('msg-action-bar')) {
        const bar = document.createElement('div');
        bar.id = 'msg-action-bar';
        bar.style.cssText = 'display:flex;gap:10px;padding:12px 16px;border-bottom:0.5px solid var(--border);background:var(--bg)';
        bar.innerHTML = `
          <button onclick="safeUI('showNewGroupPanel')"
            style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;
              padding:11px 16px;border-radius:12px;border:1.5px solid var(--green);
              background:var(--green-light);color:var(--green-dark);
              font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">
            👥 New Group Chat
          </button>
          <button onclick="safeUI('showNewDMSearch')"
            style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;
              padding:11px 16px;border-radius:12px;border:1.5px solid var(--border);
              background:var(--surface);color:var(--text);
              font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">
            💬 New Message
          </button>`;
        convList.parentNode.insertBefore(bar, convList);
      }
    }
    if (name === "my-activity")  UI.loadFullActivity();
    if (name === "conversation") {} // handled by openConversation
    // Show/hide bottom nav based on screen type
    const noBottomNav = ["auth","onboard","vibes","edit-profile","conversation","my-activity","player-profile","course-layout"];
    const bottomNav   = document.getElementById("bottom-nav");
    if (bottomNav) {
      bottomNav.style.display = noBottomNav.includes(name) ? "none" : "flex";
    }
  },

  // ── Weather ──
  refreshWeather() {
    const city = window._weatherCity || myProfile.city || "";
    loadWeather(city);
  },

  markAllNotifsRead() {
    markAllNotifsRead(window._currentUser?.uid);
  },

  openNotif(id, type, refId) {
    openNotif(id, type, refId);
  },

  addPlayerPrompt()             { addPlayerPrompt(); },
  addPlayerByName()             { addPlayerByName(); },
  addPlayerByUid(uid,name,photo){ addPlayerByUid(uid,name,photo||""); },
  removePlayer(idx)             { removePlayer(parseInt(idx)); },
  searchPlayersForCard(q)       { searchPlayersForCard(q); },

  setGameMode(mode) { const _validModes=['stroke','match','stableford','scramble','skins','bestball']; if(_validModes.includes(mode)) setGameMode(mode); },
  buildGamePanel() { buildGamePanel(); },

  loadScorecardWeather() {
    const de=document.getElementById("sc-round-date"),te=document.getElementById("sc-round-time"),ce=document.getElementById("sc-weather");
    if(!ce)return;
    const dv=de?.value||"",tv=te?.value||"08:00";
    if(!dv){ce.innerHTML="";return;}
    const d=new Date(dv+"T12:00:00"),ds=d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
    const [hh,mm]=(tv).split(":").map(Number),ap=hh>=12?"PM":"AM",h=hh%12||12;
    const ts=h+":"+String(mm||0).padStart(2,"0")+" "+ap;
    ce.id="sheet-weather";
    loadRoundDayForecast(ds,ts,window._weatherCity||"").finally(()=>{const e=document.getElementById("sheet-weather");if(e)e.id="sc-weather";});
  },

  // ── Edit profile screen — pre-fill fields ──
  goToEditProfile() {
    const p = myProfile;
    const cityParts = (p.city || "").split(",").map(s => s.trim());
    const elBio    = document.getElementById("edit-bio");
    const elCity   = document.getElementById("edit-city");
    const elState  = document.getElementById("edit-state");
    const elCourse = document.getElementById("edit-home-course");
    const elHdcp   = document.getElementById("edit-hdcp");
    const elCount  = document.getElementById("bio-count");
    if (elBio)    elBio.value    = p.bio        || "";
    if (elCity)   elCity.value   = cityParts[0] || "";
    if (elState)  elState.value  = cityParts[1] || "";
    if (elCourse) {
      elCourse.value = p.homeCourse || "";
      // Wire course autocomplete from nearby courses discovered by user
      elCourse.setAttribute('autocomplete','off');
      const acId = 'course-ac-list';
      let acList = document.getElementById(acId);
      if (!acList) {
        acList = document.createElement('div');
        acList.id = acId;
        acList.style.cssText = [
          'position:absolute','z-index:200','background:var(--bg)',
          'border:1px solid var(--border)','border-radius:10px',
          'box-shadow:0 6px 20px rgba(0,0,0,.15)','max-height:180px',
          'overflow-y:auto','width:100%','left:0','top:calc(100% + 4px)','display:none'
        ].join(';');
        const wrap = elCourse.parentNode;
        if (wrap) { wrap.style.position = 'relative'; wrap.appendChild(acList); }
      }
      const showSuggestions = () => {
        const q = elCourse.value.toLowerCase().trim();
        const courses = window._nearbyCourses || [];
        const matches = q.length < 1
          ? courses.slice(0,8)
          : courses.filter(c => c.name.toLowerCase().includes(q)).slice(0,8);
        if (!matches.length) { acList.style.display = 'none'; return; }
        acList.innerHTML = matches.map(c => {
          const safeName = c.name.replace(/'/g,"&#39;").replace(/"/g,"&quot;");
          const dist = c.dist ? c.dist.toFixed(1)+' mi' : '';
          return `<div style="padding:10px 14px;cursor:pointer;font-size:14px;color:var(--text);
              border-bottom:0.5px solid var(--border);transition:background .1s"
            onmouseover="this.style.background='var(--surface)'"
            onmouseout="this.style.background='transparent'"
            onmousedown="document.getElementById('edit-home-course').value='${safeName}';document.getElementById('${acId}').style.display='none';event.preventDefault()">
            ${esc(c.name)}${dist?` <span style="font-size:11px;color:var(--muted);">${dist}</span>`:''}
          </div>`;
        }).join('');
        acList.style.display = 'block';
      };
      elCourse.oninput = showSuggestions;
      elCourse.onfocus = showSuggestions;
      elCourse.onblur  = () => setTimeout(() => { if(acList) acList.style.display='none'; }, 200);
    }
    if (elHdcp)   elHdcp.value   = p.handicap   != null ? p.handicap : 18;
    if (elCount)  elCount.textContent = (160 - (p.bio || "").length) + " left";
    const errEl = document.getElementById("edit-profile-error");
    if (errEl) errEl.style.display = "none";
    const locStatus = document.getElementById("edit-location-status");
    if (locStatus) locStatus.style.display = "none";
  },

  adjustEditHdcp(delta) {
    const inp = document.getElementById("edit-hdcp");
    if (inp) inp.value = Math.max(0, Math.min(54, (parseInt(inp.value) || 18) + delta));
  },

  async useMyLocation() {
    const statusEl = document.getElementById("edit-location-status");
    const cityEl   = document.getElementById("edit-city");
    const stateEl  = document.getElementById("edit-state");
    if (statusEl) { statusEl.style.display = "block"; statusEl.textContent = "Detecting location…"; }
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      );
      const { latitude, longitude } = pos.coords;
      window._userLat = latitude;
      window._userLon = longitude;
      // Reverse geocode via Nominatim (OpenStreetMap, free, no key)
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      const addr  = data.address || {};
      const city  = addr.city || addr.town || addr.village || addr.county || "";
      const raw   = addr.state_code || addr.state || "";
      const state = raw.length <= 3 ? raw.toUpperCase() : raw;
      if (cityEl)   cityEl.value   = city;
      if (stateEl)  stateEl.value  = state;
      if (statusEl) statusEl.textContent = `📍 Found: ${city}, ${state}`;
    } catch (err) {
      if (statusEl) statusEl.textContent = "Could not detect location. Please enter manually.";
    }
  },

  async saveProfileEdits() {
    const bio       = (document.getElementById("edit-bio")?.value         || "").trim();
    const zipRaw    = (document.getElementById("edit-zip")?.value         || "").trim();
    const cityRaw   = (document.getElementById("edit-city")?.value        || "").trim();
    const stateRaw  = (document.getElementById("edit-state")?.value       || "").trim().toUpperCase();
    const homeCourse= (document.getElementById("edit-home-course")?.value || "").trim();
    // Build combined city string
    const city = cityRaw ? (stateRaw ? `${cityRaw}, ${stateRaw}` : cityRaw) : (zipRaw || "");
    // Geocode to get lat/lon — ZIP first (most precise), then City+State
    let profLat = null, profLon = null;
    const _STATE_MAP = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"District of Columbia"};
    // Try ZIP code first
    if (zipRaw && /^\d{5}$/.test(zipRaw)) {
      const gk = 'geo_zip_' + zipRaw;
      try { const c=sessionStorage.getItem(gk); if(c){const g=JSON.parse(c); profLat=g.lat; profLon=g.lon;} } catch(_) {}
      if (!profLat) {
        try {
          const gd = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+zipRaw+'&count=5&language=en&format=json&country_code=US')).json();
          const best = gd.results?.find(r=>r.country_code==='US') || gd.results?.[0];
          if (best) {
            profLat=best.latitude; profLon=best.longitude;
            // Auto-fill city/state if blank
            if (!cityRaw && best.name) { const ce=document.getElementById("edit-city"); if(ce) ce.value=best.name; }
            if (!stateRaw && best.admin1) {
              const stAb = Object.keys(_STATE_MAP).find(k=>_STATE_MAP[k]===best.admin1)||"";
              const se=document.getElementById("edit-state"); if(se && stAb) se.value=stAb;
            }
            sessionStorage.setItem(gk, JSON.stringify({lat:profLat,lon:profLon,ts:Date.now()}));
          }
        } catch(_) {}
      }
    }
    // Fall back to City+State geocoding
    if (!profLat && cityRaw) {
      const _cityQ = cityRaw;
      const _stateFull = _STATE_MAP[stateRaw] || stateRaw;
      const gk = 'geo_' + city.toLowerCase().replace(/[^a-z0-9]/g,'_');
      try { const c=sessionStorage.getItem(gk); if(c){const g=JSON.parse(c); if(g.ts&&Date.now()-g.ts<86400000){profLat=g.lat; profLon=g.lon;}} } catch(_) {}
      if (!profLat) {
        try {
          const url = 'https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(_cityQ)+'&count=5&language=en&format=json&country_code=US';
          const gd = await (await fetch(url)).json();
          let best = gd.results?.[0];
          if (_stateFull && gd.results?.length > 1) {
            const match = gd.results.find(r=>r.admin1===_stateFull||r.admin1?.toLowerCase()===_stateFull.toLowerCase());
            if (match) best = match;
          }
          if (best) {
            profLat=best.latitude; profLon=best.longitude;
            sessionStorage.setItem(gk, JSON.stringify({lat:profLat,lon:profLon,ts:Date.now()}));
          }
        } catch(_) {}
      }
    }
    const handicapRaw = parseInt(document.getElementById("edit-hdcp")?.value);
    const handicap = isNaN(handicapRaw) ? 18 : Math.max(0, Math.min(54, handicapRaw));
    const errEl     = document.getElementById("edit-profile-error");

    // City is required; state is strongly recommended but not blocked
    if (!cityRaw) {
      if (errEl) { errEl.textContent = "City is required."; errEl.style.display = "block"; }
      return;
    }
    if (errEl) errEl.style.display = "none";

    // Build city string — include state if provided
        const btn  = document.getElementById("save-profile-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

    try {
      // Make sure user is still signed in
      if (!window._currentUser) {
        throw new Error("Not signed in. Please sign in again.");
      }
      await saveProfileData({ bio, city, homeCourse, handicap, lat: profLat, lon: profLon });
      showToast("Profile saved! ✅");
      window._weatherCity = city;
      // Set new coords FIRST before clearing caches
      if (profLat) { window._wxLat = profLat; window._wxLon = profLon; }
      // Clear stale course caches so Discover reloads for new location
      try {
        Object.keys(sessionStorage)
          .filter(k=>k.startsWith('gc_')||k.startsWith('gc2_'))
          .forEach(k=>sessionStorage.removeItem(k));
        Object.keys(localStorage)
          .filter(k=>k.startsWith('fw_gc_'))
          .forEach(k=>localStorage.removeItem(k));
      } catch(_) {}
      window._nearbyCourses = null;
      window._coursesLoading = false;
      window._lastDiscoverCity = city;
      window._userLat = null;
      window._userLon = null;
      // If no coords found (city not geocoded), also clear wx so Discover re-geocodes
      if (!profLat) { window._wxLat = null; window._wxLon = null; }
      UI.refreshWeather();
      goScreen("profile");
    } catch (err) {
      console.error("saveProfileEdits error:", err);
      // Show the actual Firebase error so it is actionable
      const msg = err?.message || err?.code || "Could not save. Check your connection.";
      if (errEl) { errEl.textContent = msg; errEl.style.display = "block"; }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Save changes"; }
    }
  },

  // ── Profile photo ──
  triggerPhotoUpload() {
    document.getElementById("photo-file-input")?.click();
  },

  async handlePhotoUpload(input) {
    const file = input?.files?.[0];
    if (!file) return;
    const statusEl      = document.getElementById("photo-upload-status");
    const placeholder   = document.getElementById("edit-photo-placeholder");
    const preview       = document.getElementById("edit-photo-preview");
    if (statusEl)    statusEl.textContent = "Uploading…";
    try {
      const url = await uploadProfilePhoto(file);
      if (statusEl)    statusEl.textContent  = "Photo updated! ✅";
      // Show preview immediately in edit screen
      if (url && preview) {
        preview.src           = url;
        preview.style.display = "block";
        if (placeholder) placeholder.style.display = "none";
      }
      showToast("Profile photo updated ✅");
      setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 3000);
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message || "Upload failed";
      showToast("Upload failed — " + (err.message || "try again"));
    } finally {
      input.value = "";
    }
  },

  // ── Activity ──
  async loadProfileActivity() {
    const user = window._currentUser;
    if (!user) return;
    const el = document.getElementById("profile-activity-preview");
    if (!el) return;
    try {
      const items = await loadUserActivity(user.uid);
      const visible = items.filter(i => !i.hidden).slice(0, 3);
      renderActivity(visible, "profile-activity-preview", true);
    } catch (e) {
      if (el) el.innerHTML = "";
    }
  },

  async loadFullActivity() {
    const user = window._currentUser;
    if (!user) return;
    try {
      const items = await loadUserActivity(user.uid);
      renderActivity(items, "my-activity-list", true);
    } catch (e) {
      showToast("Could not load activity");
    }
  },

  async deleteActivity(id, type) {
    if (!confirm("Delete this item permanently?")) return;
    try {
      await deleteActivityItem({ id, type });
      UI.loadFullActivity();
      UI.loadProfileActivity();
    } catch (e) { showToast("Could not delete"); }
  },

  async toggleHideActivity(id, type, hidden) {
    try {
      await toggleHideItem({ id, type }, hidden);
      UI.loadFullActivity();
      UI.loadProfileActivity();
    } catch (e) { showToast("Could not update"); }
  },

  // ── Messaging ──
  async loadConversations() {
    // ── Inject New Group button (no extra HTML needed) ──────────────
    if (!document.getElementById("new-group-btn")) {
      const convList = document.getElementById("conversations-list");
      if (convList) {
        const btnWrap = document.createElement("div");
        btnWrap.style.cssText = "padding:0 0 10px;display:flex;justify-content:flex-end";
        const _btn = document.createElement("button");
        _btn.id = "new-group-btn";
        _btn.textContent = "👥 New Group";
        _btn.onclick = function(){ safeUI("showNewGroupPanel"); };
        Object.assign(_btn.style, {display:"flex",alignItems:"center",gap:"5px",background:"var(--green-light)",color:"var(--green-dark)",border:"none",borderRadius:"16px",padding:"6px 14px",fontSize:"13px",fontWeight:"600",cursor:"pointer",fontFamily:"inherit"});
        convList.parentNode.insertBefore(btnWrap, convList);
      }
    }
    // ── Inject group creation panel ──────────────────────────────────
    if (!document.getElementById("new-group-panel")) {
      const convList = document.getElementById("conversations-list");
      if (convList) {
        const panel = document.createElement("div");
        panel.id = "new-group-panel";
        panel.style.cssText = "display:none;background:var(--bg);border-radius:16px;padding:18px 16px;margin:0 0 16px;border:1.5px solid var(--green);box-shadow:0 4px 20px rgba(0,0,0,.08)";
        panel.innerHTML =
          '<div style="font-size:14px;font-weight:600;margin-bottom:10px">New Group Chat</div>' +
          '<input id="group-name-input" maxlength="40" placeholder="Group name (e.g. Saturday Crew)" ' +
          'style="width:100%;box-sizing:border-box;padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);' +
          'background:var(--bg);color:var(--text);font-size:14px;font-family:inherit;margin-bottom:10px">' +
          '<div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px">Add Members</div>' +
          '<div id="group-member-chips" style="display:flex;flex-wrap:wrap;gap:6px;min-height:10px;margin-bottom:8px"></div>' +
          '<input id="group-member-search" placeholder="Search followers by name…" oninput="safeUI(\'searchGroupMembers\',this.value)" style="width:100%;box-sizing:border-box;padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg);color:var(--text);font-size:14px;font-family:inherit;margin-bottom:8px">' +
          '<div id="group-member-search-results" style="max-height:200px;overflow-y:auto;margin-bottom:12px"></div>' +
          '<button id="create-group-btn" disabled onclick="safeUI(\'createGroup\')" ' +
          'style="width:100%;padding:10px;background:var(--green);color:#fff;border:none;border-radius:20px;' +
          'font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Create Group</button>';
        convList.parentNode.insertBefore(panel, convList);
      }
    }
    listenToConversations((convs) => {
      renderConversationsList(convs, "conversations-list");
    });
    // Update avatar
    const av = document.getElementById("msg-avatar");
    if (av) {
      const { initials, avatarColor } = await import("./ui.js?v=110");
      av.textContent = initials(myProfile.displayName);
      av.className   = "avatar-sm " + avatarColor(myProfile.uid || "");
    }
    // Pre-load following list for search
    try {
      window._msgFollowing = await loadFollowing();
    } catch(e) { window._msgFollowing = []; }
    // Clear search
    const searchEl = document.getElementById("msg-search");
    if (searchEl) searchEl.value = "";
    const followingList = document.getElementById("msg-following-list");
    if (followingList) followingList.style.display = "none";
  },

  // ── Search messages / following ──
  searchMessages(query) {
    const followingList  = document.getElementById("msg-following-list");
    const followingPeople = document.getElementById("msg-following-people");
    if (!query || !query.trim()) {
      if (followingList) followingList.style.display = "none";
      return;
    }
    if (followingList) followingList.style.display = "block";
    const people = window._msgFollowing || [];
    renderFollowingForSearch(people, query, "msg-following-people");
  },

  async openConversation(convId, otherUid, otherName, isGroup) {
    const hdr = document.getElementById("conv-header-name");
    if (hdr) hdr.textContent = otherName;
    // Inject block button for DM conversations
    const convHeader = hdr?.parentElement;
    const existingBlock = document.getElementById('conv-block-btn');
    if (existingBlock) existingBlock.remove();
    if (convHeader && !isGroup && otherUid) {
      const isBlocked = (window.myProfile?.blockedUsers||[]).includes(otherUid);
      const blockBtn = document.createElement('button');
      blockBtn.id = 'conv-block-btn';
      blockBtn.title = isBlocked ? 'Unblock user' : 'Block user';
      blockBtn.style.cssText = 'background:none;border:none;cursor:pointer;padding:6px 8px;color:var(--muted);font-size:13px;display:flex;align-items:center;gap:4px;border-radius:8px;font-family:inherit';
      blockBtn.innerHTML = isBlocked ? '🚫 Unblock' : '⋯';
      blockBtn.onclick = () => {
        // Show action sheet
        const sheet = document.createElement('div');
        sheet.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:500;display:flex;align-items:flex-end;justify-content:center';
        const curBlocked = (window.myProfile?.blockedUsers||[]).includes(otherUid);
        sheet.innerHTML = `<div style="background:var(--bg);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:16px 16px 36px">
          <div style="font-size:15px;font-weight:600;text-align:center;margin-bottom:16px;color:var(--text)">${otherName}</div>
          <button onclick="this.closest('div[style]').remove();safeUI('openPlayerProfile','${otherUid}')"
            style="width:100%;padding:14px;border-radius:12px;background:var(--surface);border:1px solid var(--border);
              color:var(--text);font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;margin-bottom:8px;text-align:left">
            👤 View Profile
          </button>
          <button onclick="this.closest('div[style]').remove();safeUI('blockUserFromConversation','${otherUid}','${otherName}')"
            style="width:100%;padding:14px;border-radius:12px;background:var(--surface);border:1px solid ${curBlocked?'var(--green)':'#ef4444'};
              color:${curBlocked?'var(--green)':'#ef4444'};font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;margin-bottom:8px;text-align:left">
            🚫 ${curBlocked?'Unblock':'Block'} ${otherName}
          </button>
          <button onclick="this.closest('div[style]').remove()"
            style="width:100%;padding:14px;border-radius:12px;background:var(--surface);border:1px solid var(--border);
              color:var(--muted);font-size:14px;cursor:pointer;font-family:inherit;text-align:center">
            Cancel
          </button>
        </div>`;
        document.body.appendChild(sheet);
        sheet.addEventListener('click', e => { if(e.target===sheet) sheet.remove(); });
      };
      convHeader.appendChild(blockBtn);
    }
    // Show member count badge for groups
    const sub = document.getElementById("conv-header-sub");
    if (sub) {
      if (isGroup) {
        const snap = await (async()=>{ try{ const {getDoc,doc,getFirestore}=await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"); const {getApp}=await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"); const d=await getDoc(doc(getFirestore(getApp()),"conversations",convId)); return d.data(); }catch{return null;} })();
        if (snap) {
          const me = window._currentUser?.uid;
          const names = Object.entries(snap.participantNames||{})
            .filter(([uid]) => uid !== me)
            .map(([,name]) => name)
            .filter(Boolean);
          const shown = names.slice(0,4);
          const extra = names.length - shown.length;
          sub.textContent = '👤 ' + shown.join(', ') + (extra > 0 ? ' +'+extra+' more' : '');
        } else { sub.textContent = 'Group'; }
        sub.style.display = "";
      } else { sub.style.display = "none"; }
    }
    goScreen("conversation");
    // Ensure bottom nav is always hidden in conversation (belt+suspenders)
    const _bn = document.getElementById('bottom-nav');
    if (_bn) _bn.style.display = 'none';
    listenToMessages(convId, (msgs) => {
      renderMessages(msgs, "messages-thread", !!isGroup);
    });
    window._activeConvId   = convId;
    window._activeConvIsGroup = !!isGroup;
    window._activeConvMeta = { otherUid, otherName, isGroup: !!isGroup };
    markConversationRead(convId, window._currentUser?.uid);
  },

  // ── View another player's profile ──────────────────────
  async openPlayerProfile(uid) {
    if (!uid || uid === window._currentUser?.uid) return; // don't open own profile
    try {
      // Record origin so back button returns to right screen
      window._ppOriginScreen = document.querySelector('.screen.active')?.id?.replace('screen-','') || 'players';
      const { getDoc, doc, getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const { getApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      const db = getFirestore(getApp());
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) { showToast("Profile not found"); return; }
      const p = { uid, ...snap.data() };
      window._viewingPlayer = p;
      // Build player profile screen inline (buildPlayerProfileScreen was missing)
      const ppScr = document.getElementById('screen-player-profile');
      if (ppScr) {
        const hn = p.handicap != null ? `HCP ${parseFloat(p.handicap).toFixed(1)}` : 'HCP --';
        const rounds = p.roundCount || p.rounds || 0;
        const vibeHtml = (p.vibes||[]).slice(0,6).map(v=>`<span style="background:var(--surface);border:1px solid var(--border);padding:4px 10px;border-radius:20px;font-size:12px;color:var(--text)">${v}</span>`).join('');
        const cityHtml = p.city ? `<div style="font-size:13px;color:var(--muted);margin-top:2px">📍 ${p.city}</div>` : '';
        ppScr.innerHTML = `
          <div class="header" style="display:flex;align-items:center;gap:12px;padding:16px;position:sticky;top:0;background:var(--bg);z-index:10;border-bottom:1px solid var(--border)">
            <button onclick="safeUI('goScreen', window._ppOriginScreen||'players')" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text);padding:0 8px 0 0">‹</button>
            <span style="font-weight:700;font-size:17px;flex:1">${p.displayName || 'Golfer'}</span>
            <button onclick="safeUI('openMessages','${p.uid}')" style="background:var(--green);color:#fff;border:none;border-radius:20px;padding:7px 16px;font-size:13px;font-weight:600;cursor:pointer">Message</button>
          </div>
          <div style="padding:20px 16px">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
              <div style="width:72px;height:72px;border-radius:50%;overflow:hidden;background:var(--green);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff">
                ${p.photoURL ? `<img src="${p.photoURL}" style="width:100%;height:100%;object-fit:cover">` : (p.displayName||'G')[0].toUpperCase()}
              </div>
              <div style="flex:1">
                <div style="font-size:18px;font-weight:700">${p.displayName || 'Golfer'}</div>
                ${cityHtml}
                <div style="display:flex;gap:16px;margin-top:8px">
                  <div style="text-align:center"><div style="font-size:18px;font-weight:700;color:var(--green)">${hn}</div><div style="font-size:11px;color:var(--muted)">HANDICAP</div></div>
                  <div style="text-align:center"><div style="font-size:18px;font-weight:700;color:var(--green)">${rounds}</div><div style="font-size:11px;color:var(--muted)">ROUNDS</div></div>
                </div>
              </div>
            </div>
            ${p.bio ? `<div style="font-size:14px;color:var(--text);line-height:1.5;margin-bottom:16px;padding:12px;background:var(--surface);border-radius:10px">${p.bio}</div>` : ''}
            ${vibeHtml ? `<div style="font-size:13px;font-weight:600;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Vibes</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px">${vibeHtml}</div>` : ''}
          </div>`;
      }
      goScreen("player-profile");
    } catch(e) {
      console.error("openPlayerProfile error:", e);
      showToast("Could not load profile");
    }
  },

  // ── Account management ──────────────────────────────────
  showSubscriptionManager() {
    // Build a modal with plan options
    const existing = document.getElementById('sub-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'sub-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:flex-end;justify-content:center';
    const curPlan = window.myProfile?.plan || 'free';
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:24px 24px 0 0;width:100%;max-width:480px;padding:24px 20px 40px">
        <div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 20px"></div>
        <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:4px">Subscription</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:20px">Current plan: <strong>${curPlan==='pro'?'⭐ Pro':curPlan==='team'?'👥 Team':'Free'}</strong></div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="padding:16px;border-radius:14px;border:2px solid ${curPlan==='pro'?'var(--green)':'var(--border)'};background:var(--surface)">
            <div style="font-size:15px;font-weight:700">⭐ Pro — $4.99/mo</div>
            <div style="font-size:13px;color:var(--muted);margin-top:4px">Unlimited messages · Advanced stats · Priority matching</div>
            ${curPlan!=='pro'?`<button onclick="safeUI('upgradeToPro')"
              style="margin-top:12px;width:100%;padding:11px;border-radius:10px;background:var(--green);color:#fff;
                border:none;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">
              Upgrade to Pro
            </button>`:'<div style="margin-top:10px;font-size:13px;color:var(--green);font-weight:600">✓ Current plan</div>'}
          </div>
          <div style="padding:16px;border-radius:14px;border:1.5px solid ${curPlan==='free'?'var(--green)':'var(--border)'};background:var(--surface)">
            <div style="font-size:15px;font-weight:700">Free</div>
            <div style="font-size:13px;color:var(--muted);margin-top:4px">Core features · 10 messages/day · Standard matching</div>
            ${curPlan!=='free'?`<button onclick="safeUI('confirmDowngrade')"
              style="margin-top:12px;width:100%;padding:11px;border-radius:10px;background:transparent;color:#ef4444;
                border:1.5px solid #ef4444;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">
              Downgrade to Free
            </button>`:'<div style="margin-top:10px;font-size:13px;color:var(--green);font-weight:600">✓ Current plan</div>'}
          </div>
        </div>
        <button onclick="document.getElementById('sub-modal')?.remove()"
          style="margin-top:20px;width:100%;padding:13px;border-radius:14px;background:var(--surface);
            color:var(--text);border:1.5px solid var(--border);font-size:14px;font-weight:500;cursor:pointer;font-family:inherit">
          Close
        </button>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
  },

  confirmDowngrade() {
    document.getElementById('sub-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'confirm-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:20px;width:100%;max-width:360px;padding:24px">
        <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:8px">Downgrade to Free?</div>
        <div style="font-size:14px;color:var(--muted);margin-bottom:20px">You'll lose Pro features at the end of your billing period.</div>
        <div style="display:flex;gap:10px">
          <button onclick="document.getElementById('confirm-modal')?.remove()"
            style="flex:1;padding:12px;border-radius:12px;background:var(--surface);border:1.5px solid var(--border);
              color:var(--text);font-size:14px;font-weight:500;cursor:pointer;font-family:inherit">Cancel</button>
          <button onclick="document.getElementById('confirm-modal')?.remove();safeUI('doDowngrade')"
            style="flex:1;padding:12px;border-radius:12px;background:#ef4444;border:none;
              color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Downgrade</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  },

  async doDowngrade() {
    await downgradeSubscription();
    const badge = document.getElementById('profile-plan-badge');
    if (badge) badge.textContent = 'Free';
  },

  upgradeToPro() {
    document.getElementById('sub-modal')?.remove();
    showToast('Upgrade coming soon — stay tuned! ⭐');
  },

  confirmDeleteAccount() {
    const modal = document.createElement('div');
    modal.id = 'delete-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:20px;width:100%;max-width:360px;padding:24px">
        <div style="font-size:18px;font-weight:700;color:#ef4444;margin-bottom:8px">Delete Account?</div>
        <div style="font-size:14px;color:var(--muted);margin-bottom:6px">This will permanently delete:</div>
        <ul style="font-size:14px;color:var(--text);margin:0 0 16px 16px;padding:0;line-height:1.8">
          <li>Your profile and all data</li>
          <li>Your messages and conversations</li>
          <li>Your round history</li>
        </ul>
        <div style="font-size:13px;color:#ef4444;font-weight:500;margin-bottom:20px">⚠️ This cannot be undone.</div>
        <div style="display:flex;gap:10px">
          <button onclick="document.getElementById('delete-modal')?.remove()"
            style="flex:1;padding:12px;border-radius:12px;background:var(--surface);border:1.5px solid var(--border);
              color:var(--text);font-size:14px;font-weight:500;cursor:pointer;font-family:inherit">Cancel</button>
          <button onclick="document.getElementById('delete-modal')?.remove();safeUI('doDeleteAccount')"
            style="flex:1;padding:12px;border-radius:12px;background:#ef4444;border:none;
              color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Delete Forever</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  },

  async doDeleteAccount() {
    await deleteAccount();
  },

  // ── Block user (from conversation screen) ──────────────────
  async blockUserFromConversation(targetUid, targetName) {
    const nowBlocked = await blockUser(targetUid, targetName);
    if (nowBlocked) {
      // Go back to messages list
      safeUI('goScreen','messages');
    }
  },

  async startConversation(otherUid, otherName) {
    const cid = await getOrCreateConversation(otherUid, otherName);
    if (!cid) return;
    UI.openConversation(cid, otherUid, otherName, false);
  },

  // ── Group messaging ──────────────────────────────────────
  async showNewDMSearch() {
    // Build a DM picker modal
    const existing = document.getElementById('dm-picker-modal');
    if (existing) { existing.remove(); return; }
    const following = await loadFollowing().catch(()=>[]);
    const modal = document.createElement('div');
    modal.id = 'dm-picker-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:600;display:flex;align-items:flex-end;justify-content:center';
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px 16px 40px;max-height:70vh;overflow-y:auto">
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px">New Message</div>
        <input id="dm-search-inp" placeholder="Search followers…" oninput="UI._filterDMSearch(this.value)"
          style="width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);
            background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;margin-bottom:12px">
        <div id="dm-search-results">
          ${following.length ? following.map(f=>`
            <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;
              background:var(--surface);margin-bottom:8px;cursor:pointer"
              onclick="document.getElementById('dm-picker-modal').remove();UI.startConversation('${f.uid}','${esc(f.displayName||'Golfer')}')">
              <div style="font-size:14px;font-weight:500;color:var(--text)">${esc(f.displayName||'Golfer')}</div>
            </div>`).join('')
            : '<div style="font-size:13px;color:var(--muted);padding:8px">No followers yet — connect with players first</div>'}
        </div>
        <button onclick="document.getElementById('dm-picker-modal').remove()"
          style="margin-top:12px;width:100%;padding:12px;border-radius:12px;background:var(--surface);
            border:1px solid var(--border);color:var(--muted);font-size:14px;cursor:pointer;font-family:inherit">
          Cancel
        </button>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
    window._dmFollowing = following;
    setTimeout(()=>document.getElementById('dm-search-inp')?.focus(), 100);
  },

  _filterDMSearch(q) {
    const following = window._dmFollowing || [];
    const lower = q.toLowerCase().trim();
    const filtered = lower ? following.filter(f=>(f.displayName||'').toLowerCase().includes(lower)) : following;
    const el = document.getElementById('dm-search-results');
    if (!el) return;
    el.innerHTML = filtered.length ? filtered.map(f=>`
      <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;
        background:var(--surface);margin-bottom:8px;cursor:pointer"
        onclick="document.getElementById('dm-picker-modal').remove();UI.startConversation('${f.uid}','${esc(f.displayName||'Golfer')}')">
        <div style="font-size:14px;font-weight:500;color:var(--text)">${esc(f.displayName||'Golfer')}</div>
      </div>`).join('')
      : '<div style="font-size:13px;color:var(--muted);padding:8px">No matches</div>';
  },

  async showNewGroupPanel() {
    window._groupMembers = []; // reset selection
    const panel = document.getElementById("new-group-panel");
    const msgSearch = document.getElementById("msg-search-area");
    if (panel) panel.style.display = panel.style.display==="none"?"block":"none";
    if (msgSearch) msgSearch.style.display = panel?.style.display==="none"?"":"none";
    if (panel && panel.style.display==="block") {
      // Pre-load followers so member search works immediately
      const chips = document.getElementById('group-member-chips');
      const results = document.getElementById('group-member-search-results');
      const searchInp = document.getElementById('group-member-search');
      if (chips) chips.innerHTML = '';
      if (searchInp) searchInp.value = '';
      if (results) {
        results.innerHTML = '<div style="padding:8px;font-size:13px;color:var(--muted)">Loading followers…</div>';
        const following = await loadFollowing().catch(()=>[]);
        window._groupFollowing = following;
        this._renderGroupSearchResults(following, results);
      }
    }
    if (panel && panel.style.display !== "none") {
      // Load following for group selection
      loadFollowing().then(people => {
        window._followingCache = people;
        renderFollowingForSearch(people, "", "group-member-search-results", true);
      });
    }
  },

  toggleGroupMember(uid, name) {
    window._groupMembers = window._groupMembers || [];
    if (window._groupMembers.length >= 9 && !window._groupMembers.find(m=>m.uid===uid)) {
      showToast('Max 9 members per group'); return;
    }
    const idx = window._groupMembers.findIndex(m => m.uid === uid);
    if (idx >= 0) { window._groupMembers.splice(idx, 1); }
    else { window._groupMembers.push({ uid, name }); }
    // Re-render results with updated Add/✓ state using our new renderer
    const results = document.getElementById('group-member-search-results');
    if (results) this._renderGroupSearchResults(window._groupFollowing||window._followingCache||[], results);
    // Update chips
    const chips = document.getElementById("group-member-chips");
    if (chips) {
      chips.innerHTML = (window._groupMembers||[]).map(m =>
        `<span style="background:var(--green-light);color:var(--green-dark);padding:3px 10px;border-radius:12px;font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:4px">
          ${esc(m.name)} <span onclick="safeUI('toggleGroupMember','${m.uid}','${esc(m.name)}')" style="cursor:pointer;font-size:14px;line-height:1">×</span>
        </span>`
      ).join("");
    }
    const btn = document.getElementById("create-group-btn");
    if (btn) btn.disabled = (window._groupMembers||[]).length < 1;
  },

  searchGroupMembers(q) {
    const results = document.getElementById('group-member-search-results');
    if (!results) return;
    const following = window._groupFollowing || [];
    const lower = (q||'').toLowerCase().trim();
    const filtered = lower
      ? following.filter(f => (f.displayName||'').toLowerCase().includes(lower))
      : following;
    this._renderGroupSearchResults(filtered, results);
  },

  _renderGroupSearchResults(list, container) {
    if (!container) return;
    const members = window._groupMembers || [];
    if (!list.length) {
      container.innerHTML = '<div style="padding:8px;font-size:13px;color:var(--muted)">No followers found — Connect with players first</div>';
      return;
    }
    container.innerHTML = list.map(f => {
      const isAdded = members.some(m => m.uid === f.uid);
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;
          border-radius:10px;background:var(--surface);margin-bottom:6px;cursor:pointer"
          onclick="safeUI('toggleGroupMember','${f.uid}','${esc(f.displayName||'Golfer')}')">
          <span style="font-size:14px;color:var(--text)">${esc(f.displayName||'Golfer')}</span>
          <span style="font-size:12px;padding:3px 10px;border-radius:20px;font-weight:600;
            background:${isAdded?'var(--green)':'var(--surface)'};
            color:${isAdded?'#fff':'var(--muted)'};border:1px solid ${isAdded?'var(--green)':'var(--border)'}"
            >${isAdded?'✓ Added':'Add'}</span>
        </div>`;
    }).join('');
  },

  async createGroup() {
    const members = window._groupMembers || [];
    if (!members.length) { showToast("Add at least 1 person to your group"); return; }
    const nameInput = document.getElementById("group-name-input");
    const groupName = nameInput?.value?.trim() || "Group Chat";
    const memberUids  = members.map(m => m.uid);
    const memberNames = Object.fromEntries(members.map(m => [m.uid, m.name]));
    const btn = document.getElementById("create-group-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Creating…"; }
    try {
      const cid = await createGroupConversation(memberUids, memberNames, groupName);
      window._groupMembers = [];
      window._groupFollowing = null;
      const panel = document.getElementById('new-group-panel');
      if (panel) panel.style.display = 'none';
      // Reset chips + search
      const chips = document.getElementById('group-member-chips');
      const inp = document.getElementById('group-name-input');
      if (chips) chips.innerHTML = '';
      if (inp) inp.value = '';
      showToast('Group "' + groupName + '" created! 🎉');
      await new Promise(r=>setTimeout(r,600));
      UI.openConversation(cid, '', groupName, true);
    } catch(e) {
      console.error('createGroup error:', e);
      showToast('Could not create group: ' + (e.message||'unknown error'));
      if (btn) { btn.disabled = false; btn.textContent = 'Create Group'; }
    }
  },

  async sendMsg() {
    const input = document.getElementById('msg-input');
    const text  = input?.value?.trim();
    const cid   = window._activeConvId;
    if (!text) return;
    if (!cid) { showToast('No active conversation'); return; }
    const prevVal = input.value;
    input.value = '';
    input.style.height = 'auto';
    try {
      const otherUid = await sendMessage(cid, text);
      // Fire notification to all recipients (DM: 1, Group: many)
      const meta = window._activeConvMeta || {};
      const recipients = Array.isArray(otherUid) ? otherUid : (otherUid ? [otherUid] : (meta.otherUid ? [meta.otherUid] : []));
      recipients.filter(r => r && r !== window._currentUser?.uid).forEach(r => {
        createNotification({
          toUid:     r,
          fromUid:   window._currentUser.uid,
          fromName:  myProfile?.displayName || "Someone",
          fromPhoto: myProfile?.photoURL    || null,
          type:      "message",
          refId:     cid,
          preview:   (window._activeConvIsGroup ? (myProfile?.displayName||"Someone")+": " : "") + text.slice(0, 80),
        });
      });
    } catch (e) {
      showToast("Could not send message");
    }
  },

  // ── Auth tab switch ──
  // ── Auth screen navigation ──
  showAuthLanding() {
    const _s = id => { const el=document.getElementById(id); if(el) el.style.display = id==='auth-landing'?'flex':'none'; };
    _s('auth-landing'); _s('auth-signin'); _s('auth-email-signup');
    // Reset all auth buttons to default state
    const lb = document.getElementById('login-btn');
    const sb = document.getElementById('signup-btn');
    if (lb) { lb.disabled=false; lb.textContent='Sign in'; }
    if (sb) { sb.disabled=false; sb.textContent='Get Started →'; }
    ['login-error','signup-error'].forEach(id => { const e=document.getElementById(id); if(e) e.style.display='none'; });
  },
  showAuthSignIn() {
    const el = id => document.getElementById(id);
    if(el('auth-landing'))    el('auth-landing').style.display    = 'none';
    if(el('auth-signin'))     el('auth-signin').style.display     = 'block';
    if(el('auth-email-signup')) el('auth-email-signup').style.display = 'none';
    // Always reset button state when panel opens — prevents stuck "Signing in…" from previous attempt
    const btn = el('login-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
    const errEl = el('login-error');
    if (errEl) errEl.style.display = 'none';
    setTimeout(() => el('login-email')?.focus(), 100);
  },
  showAuthEmailSignup() {
    // Route to the full onboard flow instead of inline form
    goScreen('onboard');
  },

  // ── Forgot password ──
  async handleForgotPassword() {
    const email = document.getElementById("login-email")?.value.trim();
    if (!email) { const e=document.getElementById("login-error"); if(e){e.textContent="Enter your email address first.";e.style.display="block";} return; }
    try {
      const { sendPasswordResetEmail, getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await sendPasswordResetEmail(getAuth(), email);
      const errEl = document.getElementById("login-error");
      if (errEl) {
        errEl.textContent = "✅ Reset email sent! Check your inbox.";
        errEl.style.color = "var(--green)";
        errEl.style.display = "block";
      }
    } catch(e) {
      showFormError("login", friendlyError(e.code));
    }
  },

  // Legacy tab switcher kept for compatibility
  switchAuthTab(tab) {
    // Map to new system
    if (tab === "login")  { UI.showAuthSignIn(); }
    if (tab === "signup") { UI.showAuthEmailSignup(); }
  },

  // ── Login ──
  async handleLogin() {
    const email = document.getElementById("login-email").value.trim();
    const pass  = document.getElementById("login-password").value;
    const btn   = document.getElementById("login-btn");
    document.getElementById("login-error").style.display = "none";
    if (!email || !pass) { showFormError("login", "Please fill in all fields."); return; }
    btn.disabled = true; btn.textContent = "Signing in…";
    try {
      await doLogin(email, pass);
    } catch (e) {
      btn.disabled = false; btn.textContent = "Sign in";
      showFormError("login", friendlyError(e.code));
    }
  },

  // ── Sign Up ──
  async handleSignup() {
    const email = document.getElementById("signup-email")?.value?.trim();
    const pass  = document.getElementById("signup-password")?.value;
    const btn   = document.getElementById("signup-btn");
    const errEl = document.getElementById("signup-error");
    const showErr = msg => { if (errEl) { errEl.textContent=msg; errEl.style.display="block"; setTimeout(()=>errEl.style.display="none",5000); } else showToast(msg); };
    if (errEl) errEl.style.display = "none";
    if (!email || !pass) { showErr("Please fill in all fields."); return; }
    if (pass.length < 6) { showErr("Password must be at least 6 characters."); return; }
    btn.disabled = true; btn.textContent = "Creating account…";
    try {
      await doSignup("", "", email, pass);
    } catch (e) {
      showErr(friendlyError(e.code));
    } finally {
      btn.disabled = false; btn.textContent = "Get Started →";
    }
  },

  // ── Sign Out ──
  async handleSignOut() {
    teardownMessaging();
    stopListeningMessages();
    stopLocationWatch();
    await doSignOut();
  },

  // ── Onboarding ──
  nextOnboard(step) {
    // Validate location fields before leaving step 2
    if (step === 3) {
      const city  = document.getElementById("onboard-city")?.value.trim()  || "";
      const state = document.getElementById("onboard-state")?.value.trim() || "";
      const err   = document.getElementById("onboard-location-error");
      if (!city) {
        if (err) { err.style.display = "block"; }
        UI.validateLocation(); // ensure button stays disabled
        return;
      }
      if (err) err.style.display = "none";
    }
    document.querySelectorAll(".onboard-step").forEach((s) => s.classList.add("hidden"));
    const el = document.getElementById("onboard-" + step);
    if (el) el.classList.remove("hidden");
  },


  adjustHdcp(delta) {
    const inp = document.getElementById("hdcp-val");
    inp.value = Math.max(0, Math.min(54, (parseInt(inp.value) || 18) + delta));
  },

  async finishOnboard() {
    const selectedVibes = [...document.querySelectorAll("#onboard-vibes .vibe-toggle.selected")]
      .map((el) => el.dataset.vibe);
    const handicap   = parseInt(document.getElementById("hdcp-val")?.value)         || 18;
    const cityRaw    = document.getElementById("onboard-city")?.value.trim()        || "";
    const stateRaw   = document.getElementById("onboard-state")?.value.trim().toUpperCase() || "";
    const city       = cityRaw && stateRaw ? `${cityRaw}, ${stateRaw}` : cityRaw || stateRaw;
    const homeCourse = document.getElementById("onboard-course")?.value.trim()      || "";

    await saveOnboardingData({ handicap, city, homeCourse, vibes: selectedVibes });

    // Make city available to weather module
    window._weatherCity = city || "";

    showToast("Welcome to Fairway Friend! 🏌️");
    goScreen("feed");
    document.getElementById("bottom-nav").style.display = "flex";

    // FIX: mark listeners active BEFORE starting them so auth.js guard doesn't double-start
    setListenersActive(true);
    initFeed();
    initNearbyPlayers();
    // Load weather for new users after onboarding
    setTimeout(() => UI.refreshWeather(), 500);
  },

  // ── Vibes ──
  toggleVibe(el) {
    el.classList.toggle("selected");
  },

  async handleSaveVibes() {
    const selected = [...document.querySelectorAll("#screen-vibes .vibe-chip.selected, #screen-vibes [data-vibe].selected")]
      .map((el) => el.dataset.vibe);
    const btn = document.querySelector("#screen-vibes button[onclick*='handleSaveVibes']");
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      await saveVibes(selected);
      // Update profile display immediately
      if (window.myProfile) window.myProfile.vibes = selected;
      if (window.updateProfileUI) updateProfileUI();
      showToast("Vibes saved! ✅");
      const msg = document.getElementById("vibes-saved-msg");
      if (msg) { msg.style.display = "block"; setTimeout(() => { msg.style.display = "none"; }, 1200); }
      setTimeout(() => goScreen("profile"), 800);
    } catch(e) {
      showToast("Could not save vibes");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save my vibe'; }
    }
  },

  // ── Feed ──
  async handlePost() {
    const ta        = document.getElementById("post-text");
    const imageFile = window._pendingPostImage || null;
    const btn       = document.querySelector(".post-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Posting…"; }
    try {
      await submitPost(ta.value, imageFile);
      ta.value = "";
      UI.clearPostImage();
    } catch(e) {
      showToast("Could not post — try again");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Post"; }
    }
  },

  // ── Post photo picker handler ──
  handlePostPhoto(input) {
    const file = input?.files?.[0];
    if (!file) return;
    window._pendingPostImage = file;
    // Show preview
    const preview   = document.getElementById("post-image-preview");
    const thumb     = document.getElementById("post-image-thumb");
    const objectUrl = URL.createObjectURL(file);
    if (thumb)   { thumb.src = objectUrl; }
    if (preview) { preview.style.display = "block"; }
    input.value = ""; // reset so same file can be re-selected
  },

  clearPostImage() {
    window._pendingPostImage = null;
    const preview = document.getElementById("post-image-preview");
    const thumb   = document.getElementById("post-image-thumb");
    if (preview) preview.style.display = "none";
    if (thumb)   { URL.revokeObjectURL(thumb.src); thumb.src = ""; }
  },

  // ── Post reactions ──
  async toggleLike(postId) {
    try { await toggleLike(postId); }
    catch(e) { showToast("Could not update"); }
  },

  toggleReply(postId) {
    // Legacy: redirect to focusReply
    this.focusReply(postId);
  },

  async submitReply(postId) {
    const input = document.getElementById("reply-input-" + postId);
    const text = input?.value?.trim();
    if (!text) return;
    const btn = document.getElementById("reply-send-" + postId);
    input.value = "";
    input.style.height = "auto";
    if (btn) { btn.disabled = true; }
    try {
      await submitReply(postId, text);
      await loadReplies(postId);
      // Scroll to bottom of replies
      const list = document.getElementById("replies-list-" + postId);
      if (list) list.scrollTop = list.scrollHeight;
    } catch(e) { showToast("Could not post comment"); }
    finally { if (btn) btn.disabled = false; }
  },

  focusReply(postId) {
    const input = document.getElementById("reply-input-" + postId);
    if (input) { input.focus(); input.scrollIntoView({ behavior: "smooth", block: "center" }); }
  },

  async deletePost(postId) {
    if (!confirm("Delete this post?")) return;
    try {
      const { deletePostById } = await import("./feed.js?v=110");
      await deletePostById(postId);
      const card = document.getElementById("post-card-" + postId);
      if (card) card.remove();
    } catch(e) { showToast("Could not delete post"); }
  },

  // ── Discover tabs ──
  discoverTab(tab) {
    const courses  = document.getElementById('disc-courses');
    const teetimes = document.getElementById('disc-teetimes');
    const tabC     = document.getElementById('disc-tab-courses');
    const tabT     = document.getElementById('disc-tab-teetimes');
    if (tab === 'courses') {
      if (courses)  courses.style.display  = 'block';
      if (teetimes) teetimes.style.display = 'none';
      if (tabC) tabC.classList.add('disc-tab-active');
      if (tabT) tabT.classList.remove('disc-tab-active');
    } else {
      if (courses)  courses.style.display  = 'none';
      if (teetimes) teetimes.style.display = 'block';
      if (tabC) tabC.classList.remove('disc-tab-active');
      if (tabT) tabT.classList.add('disc-tab-active');
    }
  },

  async loadNearbyCourses() {
    if (window._coursesLoading) return;
    window._coursesLoading = true;
    // Clear cache if radius changed since last fetch
    const _curMi = parseFloat(document.getElementById('dist-filter')?.value || '100');
    if (window._lastFetchedMiles && _curMi !== window._lastFetchedMiles) {
      try{Object.keys(sessionStorage).filter(k=>k.startsWith('gc_')).forEach(k=>sessionStorage.removeItem(k));Object.keys(localStorage).filter(k=>k.startsWith('fw_gc_')).forEach(k=>localStorage.removeItem(k));}catch(_){}
    }
    const container = document.getElementById('courses-list');
    const label     = document.getElementById('courses-radius-label');
    if (!container) { window._coursesLoading = false; return; }

    try {
      // ── 1. Resolve lat/lon ──────────────────────────────────────────
      let lat = window._wxLat, lon = window._wxLon;
      // Profile city takes priority — _weatherCity can be stale from a previous session
      const city = myProfile.city || window._weatherCity || '';
      if (!lat && city) {
        // Smart geocoding: strip to city name, add country_code=US, then disambiguate by state
        const _STATE_MAP = {
    AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
    CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
    HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',
    KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',
    MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',
    NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',
    NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',
    OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
    SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
    VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
    DC:'District of Columbia',
  };
        const _parts   = city.split(',').map(s=>s.trim());
        const _cityQ   = _parts[0]; // just the city name — open-meteo rejects "City, ST"
        const _stateAb = _parts[1] || '';
        const _stateFull = _STATE_MAP[_stateAb] || _stateAb;
        const cn  = city.trim();
        const gck = 'geo_' + cn.toLowerCase().replace(/[^a-z0-9]/g, '_');
        let geo = null;
        try { const c=sessionStorage.getItem(gck); if(c){const p=JSON.parse(c); if(p.ts&&Date.now()-p.ts<86400000) geo=p;} } catch(_){}
        if (!geo) {
          try {
            // Fetch top 5 results for city name only (state abbr breaks the query)
            const _geoUrl = 'https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(_cityQ)+'&count=5&language=en&format=json' + (_stateAb ? '&country_code=US' : '');
            const gd = await (await fetch(_geoUrl)).json();
            // Disambiguate: prefer result whose admin1 matches the state
            let _best = gd.results?.[0];
            if (_stateFull && gd.results?.length > 1) {
              const _match = gd.results.find(r => r.admin1 === _stateFull || r.admin1?.toLowerCase() === _stateFull.toLowerCase());
              if (_match) _best = _match;
            }
            if (_best) { geo={lat:_best.latitude,lon:_best.longitude,ts:Date.now()}; sessionStorage.setItem(gck,JSON.stringify(geo)); }
          } catch(_) {}
        }
        if (geo) { lat=geo.lat; lon=geo.lon; window._wxLat=lat; window._wxLon=lon; }
      }
      if (!lat) {
        try { const p=await new Promise((r,j)=>navigator.geolocation.getCurrentPosition(r,j,{timeout:5000})); lat=p.coords.latitude; lon=p.coords.longitude; window._wxLat=lat; window._wxLon=lon; } catch(_) {}
      }
      if (!lat) { container.innerHTML='<div class="empty-state">Add your city in Edit Profile to find nearby courses ⛳</div>'; window._coursesLoading=false; return; }

      // ── 2. Cache read — sessionStorage (same tab, fast) then localStorage (cross-session) ──
      const _cacheRadius = parseFloat(document.getElementById('dist-filter')?.value || 25);
      const _cacheKey = 'gc_' + (lat||0).toFixed(2) + '_' + (lon||0).toFixed(2) + '_' + _cacheRadius;
      try {
        // Check sessionStorage first (fastest), then localStorage (shared across sessions)
        const _cached = sessionStorage.getItem(_cacheKey) || localStorage.getItem('fw_' + _cacheKey);
        if (_cached) {
          const _cp = JSON.parse(_cached);
          // 6-hour TTL: GP data is fairly stable but refreshes daily
          if (_cp.ts && Date.now() - _cp.ts < 21600000 && _cp.data?.length > 0) {
            window._nearbyCourses = _cp.data;
            window._lastFetchedMiles = _cacheRadius;
            UI.filterCourses('');
            if (label) label.textContent = _cp.data.length + ' courses within ' + _cacheRadius + ' mi (cached)';
            window._coursesLoading = false;
            console.log('Discover: loaded', _cp.data.length, 'courses from cache at', _cacheRadius + 'mi');
            return;
          } else {
            // Stale — remove both copies
            try { sessionStorage.removeItem(_cacheKey); } catch(_) {}
            try { localStorage.removeItem('fw_' + _cacheKey); } catch(_) {}
          }
        }
      } catch(_) {}

      // ── 3. Skeleton ────────────────────────────────────────────────
      if(label) label.textContent='Finding courses near you…';
      container.innerHTML=Array(4).fill(0).map(()=>
        '<div class="course-card" style="opacity:.3"><div class="course-card-top"><div style="flex:1">'+
        '<div style="height:16px;background:var(--border);border-radius:4px;width:60%;margin-bottom:8px"></div>'+
        '<div style="height:11px;background:var(--border);border-radius:4px;width:35%"></div>'+
        '</div><div style="font-size:20px">⛳</div></div></div>'
      ).join('');

      // ── 4. Inject KNOWN courses immediately (zero wait) ────────────
      const seen=new Set(), norm=n=>n.toLowerCase().replace(/[^a-z0-9]/g,'');
      let courses=[];
      const KNOWN_COURSES=[
          {name:'Heritage Harbor Golf & Country Club',lat:28.1372,lon:-82.5012, type:'Country Club'},
          {name:'TPC Tampa Bay',                      lat:28.1673,lon:-82.5123, type:'Golf Course'},
          {name:'Northdale Golf & Tennis Club',       lat:28.1018,lon:-82.5223, type:'Golf Course'},
          {name:'Babe Zaharias Golf Course',          lat:28.0267,lon:-82.4334, type:'Golf Course'},
          {name:'Rogers Park Golf Course',            lat:28.0341,lon:-82.4445, type:'Golf Course'},
          {name:'Rocky Point Golf Course',            lat:27.9658,lon:-82.5732, type:'Golf Course'},
          {name:'Innisbrook Resort Copperhead',       lat:28.1278,lon:-82.7342, type:'Resort'},
          {name:'Saddlebrook Resort Golf',            lat:28.2195,lon:-82.3878, type:'Resort'},
          {name:'Bloomingdale Golfers Club',          lat:27.8612,lon:-82.2734, type:'Golf Course'},
          {name:'Lutz Executive Golf Center',         lat:28.1601,lon:-82.4887, type:'Golf Course'},
          {name:'Avila Golf & Country Club',          lat:28.1423,lon:-82.4895, type:'Country Club'},
          {name:'Cheval Golf & Country Club',         lat:28.1398,lon:-82.5078, type:'Country Club'},
          {name:'USF The Claw Golf Course',           lat:28.0622,lon:-82.4131, type:'Golf Course'},
          {name:'Tampa Palms Country Club',           lat:28.1001,lon:-82.3987, type:'Country Club'},
          {name:'Carrollwood Country Club',           lat:28.0778,lon:-82.5012, type:'Country Club'},
          {name:'Hunters Green Country Club',         lat:28.0712,lon:-82.3421, type:'Country Club'},
          {name:'Lexington Oaks Golf Club',           lat:28.1987,lon:-82.4123, type:'Golf Course'},
          {name:'Temple Terrace Golf & Country Club', lat:28.0389,lon:-82.3845, type:'Golf Course'},
          {name:'Heritage Isles Golf & Country Club', lat:28.2312,lon:-82.3745, type:'Golf Course'},
        ];
      KNOWN_COURSES.forEach(k=>{
        const d=_haversine(lat,lon,k.lat,k.lon);
        if(d<30){const key=norm(k.name); if(!seen.has(key)){seen.add(key);courses.push({...k,dist:d,type:k.type||'Golf Course',holes:18});}}
      });
      courses.sort((a,b)=>a.dist-b.dist);
      if(courses.length){
        window._nearbyCourses=courses; UI.filterCourses('');
        if(label)label.textContent='Loading more courses…';
      }

      // ── 5. Primary geo-search — Google Places (coordinate-based) ──────────────
      // When no Google Places key: GolfCourseAPI city-name fallback runs below

      if (window._googlePlacesKey) {
        // ── 5a. Google Places Nearby Search — tiled coordinate-based course discovery ──
        // GP API max radius is 50km (~31mi). For larger radii we tile the search area
        // with overlapping circles so every part of the requested radius is covered.
        try {
          const _filterMi = parseFloat(document.getElementById('dist-filter')?.value || 25);
          const _tileRad  = 40000; // 40km per tile (~25mi) — overlapping ensures no gaps

          // Build tile centers: one center + rings based on filter radius
          const _tileCenters = [[lat, lon]]; // always search center

          if (_filterMi > 25) {
            // Ring 1: 4 tiles at ~25mi offset in cardinal directions
            const _step1 = 0.36; // ~25mi in degrees lat
            const _stepLon1 = _step1 / Math.cos(lat * Math.PI / 180);
            _tileCenters.push(
              [lat + _step1, lon], [lat - _step1, lon],
              [lat, lon + _stepLon1], [lat, lon - _stepLon1]
            );
          }
          if (_filterMi > 50) {
            // Ring 2: 4 diagonal tiles at ~45mi offset
            const _step2 = 0.52;
            const _stepLon2 = _step2 / Math.cos(lat * Math.PI / 180);
            _tileCenters.push(
              [lat + _step2, lon + _stepLon2], [lat + _step2, lon - _stepLon2],
              [lat - _step2, lon + _stepLon2], [lat - _step2, lon - _stepLon2]
            );
          }
          if (_filterMi > 75) {
            // Ring 3: 8 tiles at ~70mi offset (cardinal + diagonal)
            const _step3 = 1.0;
            const _stepLon3 = _step3 / Math.cos(lat * Math.PI / 180);
            _tileCenters.push(
              [lat + _step3, lon], [lat - _step3, lon],
              [lat, lon + _stepLon3], [lat, lon - _stepLon3],
              [lat + _step3 * 0.7, lon + _stepLon3 * 0.7],
              [lat + _step3 * 0.7, lon - _stepLon3 * 0.7],
              [lat - _step3 * 0.7, lon + _stepLon3 * 0.7],
              [lat - _step3 * 0.7, lon - _stepLon3 * 0.7]
            );
          }

          console.log(`Discover: GP searching ${_tileCenters.length} tiles at ${_filterMi}mi`);

          // Run each tile search (primary + country_club type)
          for (const [tLat, tLon] of _tileCenters) {
            for (const _keyword of ['golf course', 'country club golf']) {
              let _gpPageToken = null;
              let _gpPage = 0;
              do {
                const _gpUrl = _gpPageToken
                  ? `/api/places?pagetoken=${_gpPageToken}&key=${window._googlePlacesKey}`
                  : `/api/places?location=${tLat.toFixed(5)},${tLon.toFixed(5)}&radius=${_tileRad}&keyword=${encodeURIComponent(_keyword)}&key=${window._googlePlacesKey}`;
                const _gpResp = await fetch(_gpUrl).catch(()=>null);
                if (!_gpResp?.ok) break;
                const _gpData = await _gpResp.json().catch(()=>null);
                if (!_gpData) break;

                let _newCount = 0;
                for (const place of _gpData.results || []) {
                  const pLat = place.geometry?.location?.lat;
                  const pLon = place.geometry?.location?.lng;
                  if (!pLat || !pLon) continue;
                  const _pn = (place.name || '').toLowerCase();
                  const _pt = place.types || [];
                  if (!_pt.includes('golf_course') && !_pt.includes('country_club')) {
                    const _badName = _pn.includes('school') || _pn.includes('pharmacy') ||
                      _pn.includes('hospital') || _pn.includes('church');
                    if (_badName) continue;
                  }
                  const distMi = _haversine(lat, lon, pLat, pLon);
                  if (distMi > _filterMi) continue; // outside user's requested radius
                  const name = place.name || 'Golf Course';
                  const key  = norm(name);
                  if (seen.has(key)) continue;
                  seen.add(key);
                  _newCount++;
                  courses.push({
                    name,
                    dist:          distMi,
                    lat:           pLat,
                    lon:           pLon,
                    addr:          place.vicinity || '',
                    type:          _pt.includes('country_club') ? 'Country Club' : 'Golf Course',
                    holes:         null,
                    phone:         null,
                    website:       null,
                    rating:        place.rating || null,
                    slope:         null,
                    par:           null,
                    googlePlaceId: place.place_id,
                  });
                }
                if (_newCount > 0) {
                  const _sorted = [...courses].sort((a,b)=>(a.dist||999)-(b.dist||999));
                  window._nearbyCourses = _sorted;
                  UI.filterCourses('');
                  // Write partial cache so fast reloads use what we have so far
                  try {
                    const _pck = 'gc_' + (lat||0).toFixed(2) + '_' + (lon||0).toFixed(2) + '_' + _filterMi;
                    const _pcp = JSON.stringify({data:_sorted, ts:Date.now(), partial:true, v:1});
                    sessionStorage.setItem(_pck, _pcp);
                    try { localStorage.setItem('fw_' + _pck, _pcp); } catch(_) {}
                  } catch(_) {}
                }
                console.log(`Discover: GP tile [${tLat.toFixed(2)},${tLon.toFixed(2)}] ${_keyword.replace(/ /g,'_')} → ${_gpData.results?.length||0} results, ${_newCount} new`);

                _gpPageToken = _gpData.next_page_token || null;
                if (_gpPageToken) await new Promise(r => setTimeout(r, 1800));
                _gpPage++;
              } while (_gpPageToken && _gpPage < 3);
            }

            // Small delay between tile centers to avoid rate limiting
            await new Promise(r => setTimeout(r, 250));
          }

          const _gpFinal = courses.filter(c=>c.googlePlaceId).length;
          console.log(`Discover: Google Places found ${_gpFinal} courses total at ${_filterMi}mi`);
        } catch(e) { console.warn('Discover: Google Places failed:', e.message); }
      } else {
        // No Google Places key — GolfCourseAPI fallback runs below (step 5b)
        console.log('Discover: no Google Places key set — using GolfCourseAPI fallback');
      } // end else (no Google Places key)

      // ── 5b. GolfCourseAPI city fallback (when no Google Places key) ──────
      if (!window._googlePlacesKey) {
        try {
          const _cityFull = (myProfile.city || window._weatherCity || '');
          const _cityQ    = _cityFull.split(',')[0].trim();
          const _cityGolfQ = `${_cityQ} golf courses`;
          const _stateQ   = _cityFull.split(',')[1]?.trim() || '';
          if (_cityQ) {
            // Primary: city name only — city+state returns 0 results per testing
            // _cityGolfQ ("city golf courses") gives better metro coverage
            const _searchQ = _cityQ;
            const _gcFbResp = await fetch(
              `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(_searchQ)}`,
              { headers:{'Authorization':'Key 2a981a7029msh750d3a47e40b2acp132f2fjsnb867cef35e78'}, signal:AbortSignal.timeout(6000) }
            ).catch(()=>null);
            const _gcFbData = _gcFbResp?.ok ? await _gcFbResp.json().catch(()=>null) : null;

            const _addCourse = (c) => {
              const cLat=c.location?.latitude, cLon=c.location?.longitude;
              if (!cLat || !cLon) return;
              const _distMi = _haversine(lat, lon, cLat, cLon);
              const _radiusMi = parseFloat(document.getElementById('dist-filter')?.value||100);
              if (_distMi > _radiusMi) return;
              const name = (c.club_name || c.course_name || 'Golf Course').replace(/\s*\(\d+\)\s*$/, '').trim();
              const key  = norm(name);
              if (seen.has(key)) return;
              seen.add(key);
              const tee  = c.tees?.male?.[0] || c.tees?.female?.[0];
              courses.push({
                name,
                holes:   tee?.number_of_holes || 18,
                phone:   c.location?.phone    || null,
                website: c.website            || null,
                addr:    [c.location?.address, c.location?.city, c.location?.state].filter(Boolean).join(', '),
                type:    'Golf Course',
                dist:    _distMi,
                lat: cLat, lon: cLon,
                rating:  tee?.course_rating   || null,
                slope:   tee?.slope_rating    || null,
                par:     tee?.par_total       || null,
              });
            };

            for (const c of _gcFbData?.courses || []) _addCourse(c);

            // If city search returns <5, try broader state search
            // If city-only gave few results, retry with "city golf courses"
            if (courses.length < 3 && _cityGolfQ !== _searchQ) {
              const _gcFb2 = await fetch(
                `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(_cityGolfQ)}`,
                { headers:{'Authorization':'Key 2a981a7029msh750d3a47e40b2acp132f2fjsnb867cef35e78'}, signal:AbortSignal.timeout(5000) }
              ).catch(()=>null);
              const _gcFb2Data = _gcFb2?.ok ? await _gcFb2.json().catch(()=>null) : null;
              for (const c of _gcFb2Data?.courses||[]) _addCourse(c);
              await new Promise(r=>setTimeout(r,200));
            }
            if (courses.length < 3 && _stateQ) {
              await new Promise(r=>setTimeout(r,300)); // small delay to avoid 429
              const _gcFb2 = await fetch(
                `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(_stateQ+' golf')}`,
                { headers:{'Authorization':'Key 2a981a7029msh750d3a47e40b2acp132f2fjsnb867cef35e78'}, signal:AbortSignal.timeout(6000) }
              ).catch(()=>null);
              const _gcFb2Data = _gcFb2?.ok ? await _gcFb2.json().catch(()=>null) : null;
              for (const c of _gcFb2Data?.courses || []) _addCourse(c);
            }

            if (courses.length > 0) {
              console.log(`Discover: GolfCourseAPI fallback found ${courses.length} courses for "${_cityQ}"`);
            }
          }
        } catch(e) { console.warn('Discover: GolfCourseAPI fallback failed:', e.message); }
      }

      // (Google Places now runs as primary in step 5a above)
      // (Overpass/OSM removed — GolfAPI.io is the sole coordinate source)

      // ── Step 8: Filter, sort, dedupe, persist ──────────────────────
      const radiusMi2 = parseFloat(document.getElementById('dist-filter')?.value || _curMi || 25);
      courses = courses.filter(c => c.dist <= radiusMi2);
      courses.sort((a,b) => (a.dist||999)-(b.dist||999));

      window._nearbyCourses = courses;
      window._lastFetchedMiles = radiusMi2;
      window._lastDiscoverCity = myProfile?.city || window._weatherCity || '';
      UI.filterCourses('');

      // ── Auto-expand radius if too few courses found ───────────────────
      // If fewer than 5 courses at current radius, auto-bump to next tier
      const _autoExpandTiers = [25, 50, 75, 100];
      const _curTierIdx = _autoExpandTiers.indexOf(radiusMi2);
      if (courses.length < 5 && _curTierIdx >= 0 && _curTierIdx < _autoExpandTiers.length - 1) {
        const _nextMi = _autoExpandTiers[_curTierIdx + 1];
        console.log(`Discover: only ${courses.length} courses at ${radiusMi2}mi — auto-expanding to ${_nextMi}mi`);
        const distEl = document.getElementById('dist-filter');
        if (distEl) distEl.value = _nextMi;
        // Clear cache for the expanded radius and reload
        try { Object.keys(sessionStorage).filter(k=>k.startsWith('gc_')).forEach(k=>sessionStorage.removeItem(k)); } catch(_) {}
        window._nearbyCourses = null;
        window._coursesLoading = false;
        // Brief delay then reload with new radius
        setTimeout(() => { if (document.querySelector('.screen.active')?.id === 'screen-search') safeUI('goScreen','search'); }, 300);
      }

      if (label) {
        const _lc = courses.length;
        const _lMi = radiusMi2;
        const _cp3 = (myProfile?.city||window._weatherCity||'').split(',').map(s=>s.trim());
        const _ss3 = ({AL:'alabama',AK:'alaska',AZ:'arizona',AR:'arkansas',CA:'california',CO:'colorado',CT:'connecticut',DE:'delaware',FL:'florida',GA:'georgia',HI:'hawaii',ID:'idaho',IL:'illinois',IN:'indiana',IA:'iowa',KS:'kansas',KY:'kentucky',LA:'louisiana',ME:'maine',MD:'maryland',MA:'massachusetts',MI:'michigan',MN:'minnesota',MS:'mississippi',MO:'missouri',MT:'montana',NE:'nebraska',NV:'nevada',NH:'new-hampshire',NJ:'new-jersey',NM:'new-mexico',NY:'new-york',NC:'north-carolina',ND:'north-dakota',OH:'ohio',OK:'oklahoma',OR:'oregon',PA:'pennsylvania',RI:'rhode-island',SC:'south-carolina',SD:'south-dakota',TN:'tennessee',TX:'texas',UT:'utah',VT:'vermont',VA:'virginia',WA:'washington',WV:'west-virginia',WI:'wisconsin',WY:'wyoming'})[_cp3[1]?.toUpperCase()]||(_cp3[1]||'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
        const _sc3 = (_cp3[0]||'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
        const _sgCityLink = `<a href="https://supremegolf.com/explore/united-states/${_ss3}/${_sc3}" target="_blank" rel="noopener" style="font-size:11px;color:var(--green);text-decoration:none;font-weight:600;white-space:nowrap">+ Supreme Golf ↗</a>`;
        label.innerHTML = (_lc ? `${_lc} courses within ${_lMi} mi` : `No courses found within ${_lMi} mi`) + ' &nbsp;' + _sgCityLink;
      }

      // Cache final courses — radius-keyed so 25mi and 50mi have separate caches
      try {
        const cKey = 'gc_' + (window._wxLat||0).toFixed(2) + '_' + (window._wxLon||0).toFixed(2) + '_' + radiusMi2;
        const cPayload = JSON.stringify({data:courses, ts:Date.now(), v:1});
        sessionStorage.setItem(cKey, cPayload);
        // Write to localStorage so next user at same location skips GP entirely
        try { localStorage.setItem('fw_' + cKey, cPayload); } catch(_) {}
      } catch(_) {}

    } catch(e) {
      console.error('courses error:', e.message);
      if (label) label.textContent = 'Error loading courses';
    } finally {
      window._coursesLoading = false;
      // Kick off background Ryze pre-cache 3s after courses load
      setTimeout(_precacheRyzeCourses, 3000);
    }
  },

  filterCourses(query) {
    const courses  = window._nearbyCourses || [];
    const q        = (query||'').toLowerCase();
    const maxDist  = parseFloat(document.getElementById('dist-filter')?.value||100);
    const label    = document.getElementById('courses-radius-label');
    const container = document.getElementById('courses-list');

    let filtered = courses.filter(c => {
      if (maxDist < 100 && (c.dist||999) > maxDist) return false;
      if (!q) return true;
      return (c.name||'').toLowerCase().includes(q) || (c.addr||'').toLowerCase().includes(q);
    });

    const total    = courses.filter(c => maxDist >= 100 || (c.dist||999) <= maxDist).length;
    const distText = maxDist >= 100 ? '100 mi' : maxDist + ' mi';

    if (label) {
      const _lText = filtered.length === total
        ? `${total} courses within ${distText}`
        : `${filtered.length} of ${total} courses within ${distText}`;
      // Add Supreme Golf link for full tee time inventory
      const _cityFull2 = (myProfile?.city || window._weatherCity || '').trim();
      const _cityParts2 = _cityFull2.split(',').map(s=>s.trim());
      const _sgState2 = ({AL:'alabama',AK:'alaska',AZ:'arizona',AR:'arkansas',CA:'california',CO:'colorado',CT:'connecticut',DE:'delaware',FL:'florida',GA:'georgia',HI:'hawaii',ID:'idaho',IL:'illinois',IN:'indiana',IA:'iowa',KS:'kansas',KY:'kentucky',LA:'louisiana',ME:'maine',MD:'maryland',MA:'massachusetts',MI:'michigan',MN:'minnesota',MS:'mississippi',MO:'missouri',MT:'montana',NE:'nebraska',NV:'nevada',NH:'new-hampshire',NJ:'new-jersey',NM:'new-mexico',NY:'new-york',NC:'north-carolina',ND:'north-dakota',OH:'ohio',OK:'oklahoma',OR:'oregon',PA:'pennsylvania',RI:'rhode-island',SC:'south-carolina',SD:'south-dakota',TN:'tennessee',TX:'texas',UT:'utah',VT:'vermont',VA:'virginia',WA:'washington',WV:'west-virginia',WI:'wisconsin',WY:'wyoming'})[_cityParts2[1]?.toUpperCase()] || 'united-states';
      const _sgCitySlug2 = (_cityParts2[0]||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      const _sgCityUrl = `https://supremegolf.com/explore/united-states/${_sgState2}/${_sgCitySlug2}`;
      label.innerHTML = `${_lText} &nbsp;<a href="${_sgCityUrl}" target="_blank" rel="noopener" style="font-size:11px;color:var(--green);text-decoration:none;font-weight:600;white-space:nowrap">+ Supreme Golf ↗</a>`;
    }

    if (!container) return;
    if (!filtered.length) {
      container.innerHTML = `<div class="empty-state" style="padding:32px 20px;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">⛳</div>
        <div style="font-weight:600;margin-bottom:8px;color:var(--text)">No courses found</div>
        <div style="color:var(--muted);font-size:14px">Try expanding the radius or changing your city in Profile</div>
      </div>`;
      return;
    }

    const norm2 = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');

    // Determine access type from name, OSM tags, and type field
    const getAccessType = c => {
      const n = norm2(c.name);
      const raw = (c.name||'').toLowerCase();
      // Explicit private indicators
      if (c.access === 'private' || c.type === 'Country Club') return 'private';
      if (raw.includes('country club') || raw.includes('cc ') || raw.endsWith(' cc')) return 'private';
      if (raw.includes('private')) return 'private';
      if (raw.includes('yacht') || raw.includes('polo')) return 'private';
      // Military / government
      if (raw.includes('military') || raw.includes('air force') || raw.includes('naval')) return 'military';
      // Resort
      if (raw.includes('resort') || raw.includes('marriott') || raw.includes('hilton') ||
          raw.includes('hyatt') || raw.includes('ritz') || raw.includes('omni')) return 'resort';
      // University
      if (raw.includes('usf') || raw.includes('university') || raw.includes(' college')) return 'university';
      // Semi-private / club
      if (raw.includes('semi') || raw.includes('members')) return 'semi-private';
      // Executive / par-3
      if (raw.includes('executive') || raw.includes('par 3') || raw.includes('par-3') ||
          (c.par && c.par < 65)) return 'executive';
      return 'public';
    };

    const ACCESS_BADGE = {
      'private':     { label: 'Private',      bg: '#7f1d1d', color: '#fca5a5', icon: '🔒' },
      'semi-private':{ label: 'Semi-Private', bg: '#78350f', color: '#fcd34d', icon: '🔑' },
      'resort':      { label: 'Resort',       bg: '#1e3a5f', color: '#93c5fd', icon: '🏨' },
      'military':    { label: 'Military',     bg: '#14532d', color: '#86efac', icon: '🎖️' },
      'university':  { label: 'University',   bg: '#3b0764', color: '#d8b4fe', icon: '🎓' },
      'executive':   { label: 'Executive',    bg: '#374151', color: '#d1d5db', icon: '⛳' },
      'public':      { label: 'Public',       bg: '#14532d', color: '#86efac', icon: '⛳' },
    };

    const isPrivate = c => getAccessType(c) === 'private' || getAccessType(c) === 'semi-private';

    // ── Supreme Golf URL helpers (computed once per render) ─────────────────────
    const _SG_ST = {
      AL:'alabama',AK:'alaska',AZ:'arizona',AR:'arkansas',CA:'california',
      CO:'colorado',CT:'connecticut',DE:'delaware',FL:'florida',GA:'georgia',
      HI:'hawaii',ID:'idaho',IL:'illinois',IN:'indiana',IA:'iowa',KS:'kansas',
      KY:'kentucky',LA:'louisiana',ME:'maine',MD:'maryland',MA:'massachusetts',
      MI:'michigan',MN:'minnesota',MS:'mississippi',MO:'missouri',MT:'montana',
      NE:'nebraska',NV:'nevada',NH:'new-hampshire',NJ:'new-jersey',NM:'new-mexico',
      NY:'new-york',NC:'north-carolina',ND:'north-dakota',OH:'ohio',OK:'oklahoma',
      OR:'oregon',PA:'pennsylvania',RI:'rhode-island',SC:'south-carolina',
      SD:'south-dakota',TN:'tennessee',TX:'texas',UT:'utah',VT:'vermont',
      VA:'virginia',WA:'washington',WV:'west-virginia',WI:'wisconsin',WY:'wyoming'
    };
    const _sgSlug = s => (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const _sgUserCity = (myProfile?.city || window._weatherCity || '').split(',').map(s=>s.trim());
    const _sgUserState = _SG_ST[_sgUserCity[1]?.toUpperCase()] || _sgSlug(_sgUserCity[1]||'');
    const _sgToday    = new Date().toISOString().slice(0,10);
    // Build URL using course's own city/state from addr when available
    const _supremeGolfUrl = (c) => {
      // addr format: "2.6 mi away · Tampa, FL" — strip distance prefix first
      const addr   = (c.addr||'').replace(/^[^·]*·\s*/, '').replace(/^[\d.]+\s*mi[^,]*,?\s*/i,'');
      const parts  = addr.split(',').map(s=>s.trim()).filter(Boolean);
      const stAb   = parts.length>=2 ? parts[parts.length-1]?.match(/([A-Z]{2})/)?.[1] : null;
      const cityRaw= parts.length>=2 ? parts[parts.length-2] : '';
      const st     = _SG_ST[stAb] || _sgUserState || 'united-states';
      const city   = _sgSlug(cityRaw || _sgUserCity[0] || 'golf');
      const slug   = _sgSlug(c.name) + '-' + st;
      return `https://supremegolf.com/explore/united-states/${st}/${city}/${slug}?date=${_sgToday}&players=2`;
    };
    // ── Smart DOM diff — add/remove only changed cards, scroll preserved ──
    if (!filtered.length) {
      container.innerHTML = `<div class="empty-state" style="padding:32px 20px;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">⛳</div>
        <div style="font-weight:600;margin-bottom:8px;color:var(--text)">No courses found</div>
        <div style="color:var(--muted);font-size:14px">Try expanding the radius or changing your city in Profile</div>
      </div>`;
      return;
    }

    // Remove skeleton loader cards (no data-ckey) — they have no stable key so diff never cleans them
    container.querySelectorAll('.course-card:not([data-ckey])').forEach(el => el.remove());

    // Map currently rendered cards by stable key (course name)
    const _existing = new Map();
    container.querySelectorAll('.course-card[data-ckey]').forEach(el => _existing.set(el.dataset.ckey, el));

    // Remove cards that are no longer in the filtered set
    const _keep = new Set(filtered.map(c => c.name));
    _existing.forEach((el, k) => { if (!_keep.has(k)) el.remove(); });

    // Build card HTML using variables already in scope (_supremeGolfUrl, getAccessType, ACCESS_BADGE)
    const _buildCard = (c) => {
      const dStr  = c.dist != null ? `${c.dist.toFixed(1)} mi away` : '';
      const hStr  = c.holes  ? ` · ${c.holes} holes` : '';
      const pStr  = c.par    ? ` · Par ${c.par}` : '';
      const slStr = c.slope  ? ` · Slope ${c.slope}` : '';
      const maps  = `https://maps.google.com/?q=${encodeURIComponent(c.name + ' golf course')}`;
      const info  = [pStr, slStr].filter(Boolean).join('');
      const rat   = c.rating ? ` · ⭐ ${c.rating}` : '';
      const _ac   = getAccessType(c);
      const _bdg  = ACCESS_BADGE[_ac] || ACCESS_BADGE['public'];
      const _sg   = _supremeGolfUrl(c);
      const _prv  = _ac === 'private';
      const sn    = c.name.replace(/"/g, '&quot;');
      return `<div class="course-card" data-ckey="${sn}">
        <div class="course-card-top"><div style="flex:1">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:2px">
            <div class="course-name" style="margin-bottom:0">${c.name}</div>
            <span style="flex-shrink:0;font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;padding:2px 7px;border-radius:20px;background:${_bdg.bg}22;color:${_bdg.color};border:1px solid ${_bdg.bg}55">${_bdg.icon} ${_bdg.label}</span>
          </div>
          <div class="course-meta">${dStr}${hStr}${info}${rat}${c.addr ? ' · ' + c.addr : ''}</div>
        </div></div>
        <div class="course-actions">
          <button class="course-btn course-btn-gps" data-cname="${sn}" data-clat="${c.lat||''}" data-clon="${c.lon||''}" onclick="safeUI('launchGpsForCourse',this.dataset.cname,this.dataset.clat,this.dataset.clon)" style="background:var(--green);color:#fff;border:none;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">▶ Play GPS</button>
          <button class="course-btn" data-cname="${sn}" onclick="safeUI('openScorecardForCourse',this.dataset.cname)" style="background:var(--surface);color:var(--text);border:1.5px solid var(--border);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">📋 Scorecard</button>

          <a href="${maps}" target="_blank" rel="noopener" class="course-btn course-btn-map">📍 Directions</a>
          ${c.phone   ? `<a href="tel:${c.phone}" class="course-btn">📞 Call</a>`   : ''}
          ${c.website ? `<a href="${c.website}" target="_blank" rel="noopener" class="course-btn">🌐 Website</a>` : ''}
        </div></div>`;
    };

    // Insert/reorder cards to match sorted filtered order, without touching unchanged ones
    let _prev = null;
    for (const c of filtered) {
      const _el = _existing.get(c.name);
      if (_el) {
        // Existing card — reorder if needed
        const _target = _prev ? _prev.nextElementSibling : container.firstElementChild;
        if (_el !== _target) container.insertBefore(_el, _target || null);
        _prev = _el;
      } else {
        // New card — create and insert
        const _t = document.createElement('div');
        _t.innerHTML = _buildCard(c);
        const _ne = _t.firstElementChild;
        const _target = _prev ? _prev.nextElementSibling : container.firstElementChild;
        container.insertBefore(_ne, _target || null);
        _prev = _ne;
      }
    }
  },

  bookTeeTime(name, website) {
    if (website && website.trim()) {
      window.open(website, '_blank', 'noopener,noreferrer');
    } else {
      const url = `https://supremegolf.com/search?searchQuery=${encodeURIComponent(name)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  },

  postTeeTimeAtCourse(courseName) {
    safeUI('bookTeeTime', courseName, '');
  },

  filterPlayers(q) {
    const vibeFilter = window._activeVibeFilter || '';
    const milesFilter = parseFloat(document.getElementById('miles-filter')?.value || 9999);
    filterPlayers(q, vibeFilter, milesFilter);
  },

  setPlayerVibeFilter(vibe) {
    window._activeVibeFilter = (window._activeVibeFilter === vibe) ? '' : vibe;
    document.querySelectorAll('.vibe-filter-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.vibe === window._activeVibeFilter);
    });
    this.applyPlayerFilters();
  },

  applyPlayerFilters() {
    const q = document.getElementById('player-search')?.value || '';
    const vibe = window._activeVibeFilter || '';
    const miles = parseFloat(document.getElementById('miles-filter')?.value || 9999);
    filterPlayers(q, vibe, miles);
  },

  async handleSaveRound() {
    const courseName = document.getElementById('sc-course-input')?.value?.trim()
      || window._pendingGpsCourse || '';
    await saveRound(courseName);
  },

  // ── Course Layout ──────────────────────────────────────────────
  // ── Fetch scorecard from Ryze API ────────────────────────────
  async _fetchRyzeCourse(courseName) {
    // 1. Local hardcoded data first — instant, zero API calls
    const local = _lookupScorecard(courseName);
    if (local) {
      console.log('[SC] Local scorecard:', local.name);
      return _scorecardToRyzeFormat(local.name, local.holes);
    }
    // 2. GolfCourseAPI.com fallback
    const cacheKey = 'gcapi_' + courseName.toLowerCase().replace(/[^a-z0-9]/g,'_');
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch(_) {}
    try {
      const resp = await fetch(
        `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(courseName)}`,
        { headers: { 'Authorization': 'Key Q4EAEMMFI54TY4HEA62GEOH3BI' }, signal: AbortSignal.timeout(8000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        const course = data.courses?.[0];
        if (course) {
          const ryze = _gcapiToRyzeFormat(course);
          try { sessionStorage.setItem(cacheKey, JSON.stringify(ryze)); } catch(_) {}
          return ryze;
        }
      }
    } catch(e) { console.warn('[SC] GolfCourseAPI failed:', e.message); }
    // 3. foretee.com scrape via server proxy (works for any US course)
    try {
      const scrapeKey = 'foretee_' + courseName.toLowerCase().replace(/[^a-z0-9]/g,'_');
      const scrapeCached = sessionStorage.getItem(scrapeKey);
      if (scrapeCached) return JSON.parse(scrapeCached);
      const scraped = await _scrapeForeteeScorecard(courseName);
      if (scraped?.holes?.length >= 9) {
        const ryze = _scorecardToRyzeFormat(courseName, scraped.holes);
        try { sessionStorage.setItem(scrapeKey, JSON.stringify(ryze)); } catch(_) {}
        console.log('[SC] foretee scrape success:', courseName);
        return ryze;
      }
    } catch(e) { console.warn('[SC] foretee scrape failed:', e.message); }
    return null;
  },

  // ── Show tee picker sheet ─────────────────────────────────────
  _showTeePicker(courseName, tees, onSelect) {
    // Remove any existing picker
    document.getElementById('tee-picker-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'tee-picker-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:flex-end;justify-content:center';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--surface);border-radius:18px 18px 0 0;padding:20px 20px 32px;width:100%;max-width:480px;box-sizing:border-box';

    const title = `<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:4px">Select Tees</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px">${courseName}</div>`;

    const teeRows = tees.map((t, i) => `
      <label style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);cursor:pointer">
        <input type="radio" name="tee-pick" value="${i}" ${i===0?'checked':''} style="accent-color:var(--green);width:17px;height:17px">
        <div>
          <span style="font-size:14px;font-weight:600;color:var(--text)">${t.color}</span>
          <span style="font-size:12px;color:var(--muted);margin-left:8px">${t.yards ? t.yards + ' yds' : ''} ${t.slope ? '· ' + t.slope + '/' + (t.courseRating||'') : ''}</span>
        </div>
      </label>`).join('');

    sheet.innerHTML = title + teeRows +
      `<button id="tee-picker-go" style="margin-top:18px;width:100%;background:var(--green);color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">▶ Start Round</button>
       <button id="tee-picker-cancel" style="margin-top:10px;width:100%;background:transparent;border:none;color:var(--muted);font-size:14px;cursor:pointer;font-family:inherit">Cancel</button>`;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('tee-picker-cancel').onclick = () => overlay.remove();
    document.getElementById('tee-picker-go').onclick = () => {
      const sel = sheet.querySelector('input[name="tee-pick"]:checked');
      const idx = sel ? parseInt(sel.value) : 0;
      overlay.remove();
      onSelect(tees[idx]);
    };
  },

  // ── Launch GPS for a course (with tee picker + live scorecard) ─
  async launchGpsForCourse(courseName, latStr, lonStr) {
    const lat = parseFloat(latStr) || window._wxLat;
    const lon = parseFloat(lonStr) || window._wxLon;
    if (!lat) { showToast('Set your location in profile to use GPS'); return; }

    // Fetch Ryze API data in background
    const ryzeData = await this._fetchRyzeCourse(courseName);

    const proceed = async (selectedTee) => {
      // Apply API scorecard data if available
      if (ryzeData?.scorecard?.length >= 18) {
        const holes = ryzeData.scorecard.map(h => ({
          h:     h.Hole,
          par:   h.Par,
          hcp:   h.Handicap,
          yards: selectedTee && h.tees
            ? Object.values(h.tees).find(t => t.color === selectedTee.color)?.yards
              ?? Object.values(h.tees)[0]?.yards
            : null,
        }));
        const teeBoxData = ryzeData.teeBoxes?.find(t => t.tee === selectedTee?.color) || ryzeData.teeBoxes?.[0];
        applyApiCourseData(holes, teeBoxData?.handicap, teeBoxData?.slope);
        console.log('[GPS] Applied Ryze scorecard for', courseName, '· tee:', selectedTee?.color);
      }

      const scInp = document.getElementById('sc-course-input');
      if (scInp) scInp.value = courseName;
      window._pendingGpsCourse = courseName;
      window._pendingGpsLat    = lat;
      window._pendingGpsLon    = lon;
      safeUI('goScreen','scorecard');
      await new Promise(r => setTimeout(r, 400));
      const body = document.getElementById('gps-body');
      if (body) body.style.display = 'block';
      safeUI('startGpsTracking');
      showToast(`▶ GPS started for ${courseName}`);
    };

    // Show tee picker if we have tee data
    const teeBoxes = ryzeData?.teeBoxes;
    if (teeBoxes?.length > 0) {
      const tees = teeBoxes.map(t => ({
        color: t.tee,
        slope: t.slope,
        courseRating: t.handicap,
        yards: ryzeData.scorecard?.[0]?.tees
          ? Object.values(ryzeData.scorecard[0].tees).find(x => x.color === t.tee)?.yards
          : null,
      }));
      this._showTeePicker(courseName, tees, proceed);
    } else {
      // No tee data — go straight in
      await proceed(null);
    }
  },

  // ── Open scorecard for a course (no GPS) ─────────────────────
  async openScorecardForCourse(courseName) {
    resetHolesToDefault();
    const scInp = document.getElementById('sc-course-input');
    if (scInp) scInp.value = courseName;

    const ryzeData = await this._fetchRyzeCourse(courseName);

    const apply = (selectedTee) => {
      if (ryzeData?.scorecard?.length >= 18) {
        const holes = ryzeData.scorecard.map(h => ({
          h:     h.Hole,
          par:   h.Par,
          hcp:   h.Handicap,
          yards: selectedTee && h.tees
            ? Object.values(h.tees).find(t => t.color === selectedTee.color)?.yards
              ?? Object.values(h.tees)[0]?.yards
            : null,
        }));
        const teeBoxData = ryzeData.teeBoxes?.find(t => t.tee === selectedTee?.color) || ryzeData.teeBoxes?.[0];
        applyApiCourseData(holes, teeBoxData?.handicap, teeBoxData?.slope);
      }
      safeUI('goScreen','scorecard');
      showToast(`📋 Scorecard loaded for ${courseName}`);
    };

    const teeBoxes = ryzeData?.teeBoxes;
    if (teeBoxes?.length > 0) {
      const tees = teeBoxes.map(t => ({
        color: t.tee,
        slope: t.slope,
        courseRating: t.handicap,
        yards: ryzeData.scorecard?.[0]?.tees
          ? Object.values(ryzeData.scorecard[0].tees).find(x => x.color === t.tee)?.yards
          : null,
      }));
      this._showTeePicker(courseName, tees, apply);
    } else {
      safeUI('goScreen','scorecard');
      showToast(`📋 Scorecard opened for ${courseName}`);
    }
  },

  async openCourseLayoutScreen() {
    const courseName = document.getElementById('sc-course-input')?.value?.trim()
      || window.myProfile?.homeCourse || '';
    const cLat = window._pendingGpsLat || window._wxLat;
    const cLon = window._pendingGpsLon || window._wxLon;
    if (!cLat) { showToast('Set your city in profile to use course layout'); return; }
    await openCourseLayout(courseName, cLat, cLon);
  },

  closeCourseLayout() {
    closeCourseLayout();
    const origin = window._courseLayoutOrigin || 'scorecard';
    safeUI('goScreen', origin);
  },

  selectLayoutHole(h) { selectLayoutHole(parseInt(h)); },

  toggleCourseLayoutGPS() {
    if (gpsIsActive) {
      stopGpsRound();
      document.getElementById('gps-status-dot')?.style && (document.getElementById('gps-status-dot').style.background = 'var(--border)');
      showToast('GPS tracking stopped');
    } else {
      safeUI('startGpsTracking');
    }
  },

  // ── GPS Tracking ───────────────────────────────────────────────
  async startGpsTracking() {
    const courseName = window._pendingGpsCourse
      || document.getElementById('sc-course-input')?.value?.trim() || '';
    if (gpsIsActive) {
      stopGpsRound();
      document.getElementById('gps-status-dot')?.style && (document.getElementById('gps-status-dot').style.background = 'var(--border)');
      document.getElementById('gps-start-btn') && (document.getElementById('gps-start-btn').textContent = '▶ Start');
      showToast('GPS tracking stopped');
      return;
    }
    const cLat = window._pendingGpsLat || window._wxLat;
    const cLon = window._pendingGpsLon || window._wxLon;
    if (!cLat) { showToast('Set your location in profile to use GPS tracking'); return; }

    if (!document.getElementById('gps-pulse-style')) {
      const st = document.createElement('style');
      st.id = 'gps-pulse-style';
      st.textContent = '@keyframes gpsPulse{0%,100%{opacity:1}50%{opacity:.4}}';
      document.head.appendChild(st);
    }
    await startGpsRound(courseName, cLat, cLon, ({ hole, holes, pos, distToPin }) => {
      const dot  = document.getElementById('gps-status-dot');
      const hEl  = document.getElementById('gps-hole');
      const dEl  = document.getElementById('gps-dist');
      const hBig = document.getElementById('gps-hole-big');
      const dBig = document.getElementById('gps-dist-big');
      const curHole = holes?.[hole-1];
      if (dot) { dot.style.background = '#22c55e'; dot.style.animation = 'gpsPulse 1.5s infinite'; }
      if (hEl)  hEl.textContent  = `Hole ${hole}`;
      if (hBig) hBig.textContent = hole;
      if (distToPin != null) {
        const ft = Math.round(distToPin);
        const yd = Math.round(ft / 3);
        if (dEl)  dEl.textContent  = `${yd}yd`;
        if (dBig) dBig.textContent = `${yd}yd`;
      }
    });
  },

  logGpsShot() {
    const shot = logShot();
    if (!shot) return;
    const strip = document.getElementById('gps-shots-strip');
    if (!strip) return;
    const chip = document.createElement('span');
    chip.className = 'gps-shot-chip';
    chip.textContent = `🏌️ H${shot.hole}`;
    chip.title = `Hole ${shot.hole} shot`;
    chip.style.cssText = 'display:inline-block;padding:4px 8px;border-radius:20px;font-size:11px;font-weight:600;background:var(--green);color:#fff;margin:2px';
    strip.appendChild(chip);
    showToast('Shot logged ✅');
  },

  nextGpsHole() { nextHole(); },
  prevGpsHole() { prevHole(); },

  newRound() {
    resetScores();
    buildScoreTable();
    showToast('Scorecard cleared ✅');
  },

  setGame(el, game) {
    document.querySelectorAll('.game-mode-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    setGameMode(game);
    buildGamePanel();
  },

  toggleChip(el) { toggleChip(el); },

  // ── Proxy methods for safeUI dispatch ──
  loadReplies(postId)  { loadReplies(postId); },
  openMessages(uid)    { if(typeof openMessages==='function') openMessages(uid); else safeUI('goScreen','messages'); },
};

// ── Expose safeUI ─────────────────────────────────────────────────────────────
window.safeUI = function(action, ...args) {
  if (!action) return;
  if (typeof UI[action] === 'function') {
    try { UI[action](...args); } catch(e) { console.error('[FW]', action, e.message); }
  } else if (action === 'goScreen') {
    try { goScreen(args[0]); } catch(e) { console.error('[FW] goScreen', e.message); }
  } else {
    console.warn('[FW] Unknown safeUI action:', action);
  }
};

// ── Game panel HTML templates ────────────────────────────────────────────────
const GAME_PANELS = {
  stroke: ``,
  bingo: `<div class="game-card"><div class="game-card-title"><span>🎯</span>Bingo Bango Bongo</div>
    <div class="game-info">Three points per hole — <strong>Bingo</strong>: first on the green · <strong>Bango</strong>: closest to pin once all are on · <strong>Bongo</strong>: first to hole out.</div></div>`,
  scramble: `<div class="game-card"><div class="game-card-title"><span>🤝</span>Scramble</div>
    <div class="game-info">All players tee off — best shot selected, everyone plays from there. Repeat until holed.</div></div>`,
  match: `<div class="game-card"><div class="game-card-title"><span>⚔️</span>Match play</div>
    <div class="game-info">Win the hole, win a point. Leading by more holes than remain wins the match. Ties halved.</div></div>`,
  skins: `<div class="game-card"><div class="game-card-title"><span>💀</span>Skins</div>
    <div class="game-info">Each hole is worth a "skin". Win the hole outright to take the skin. Ties carry over — skins accumulate until someone wins a hole outright.</div></div>`,
  bestball: `<div class="game-card"><div class="game-card-title"><span>🎱</span>Best ball — 2v2</div>
    <div class="game-info">Each player plays their own ball. Lowest score on your team counts per hole.</div></div>`,
  nassau: `<div class="game-card"><div class="game-card-title"><span>💰</span>Nassau</div>
    <div class="game-info">Three bets: front 9, back 9, and overall 18. Classic $5 each = $15 total at stake.</div>
    <div class="nassau-grid">
      <div class="nassau-cell"><div class="nassau-cell-label">Front 9</div><div class="nassau-cell-val">—</div></div>
      <div class="nassau-cell"><div class="nassau-cell-label">Back 9</div><div class="nassau-cell-val">—</div></div>
      <div class="nassau-cell"><div class="nassau-cell-label">Overall</div><div class="nassau-cell-val">—</div></div>
    </div></div>`,
};

function showFormError(form, msg) {
  const el = form?.querySelector?.('.form-error') || document.getElementById('form-error');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
// Load Google Places API key from localStorage if set
window._googlePlacesKey = localStorage.getItem('fw_google_places_key') || 'AIzaSyAQSzxQm7wfeih4X5gAggZiZhCjMLDipjA';

// ── Discover tee times ────────────────────────────────────────────────────────
function loadDiscoverTeeTimes() {
  const el = document.getElementById('disc-tee-nearby-list');
  if (!el) return;
  const courses = (window._nearbyCourses || []).slice(0, 3);
  if (!courses.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">No courses loaded yet</div>';
    return;
  }
  const now = new Date();
  const hourFilter = document.querySelector('.disc-time-pill.disc-time-active')?.dataset?.hour || 'all';
  function getSlots(courseName) {
    const slots = [];
    for (let h = 7; h <= 17; h++) {
      if (hourFilter !== 'all' && h !== parseInt(hourFilter)) continue;
      for (const m of [0, 8, 16, 24, 32, 40, 48, 56]) {
        if (h < now.getHours() + 1 && new Date().toDateString() === new Date().toDateString()) continue;
        const ampm = h < 12 ? 'AM' : 'PM';
        const dh = h > 12 ? h - 12 : h;
        slots.push(`${dh}:${String(m).padStart(2,'0')} ${ampm}`);
      }
    }
    return slots.slice(0, 4);
  }
  el.innerHTML = courses.map(c => {
    const slots = getSlots(c.name);
    const bookBase = c.website || `https://supremegolf.com/search?searchQuery=${encodeURIComponent(c.name)}`;
    const slotsHtml = slots.length
      ? slots.map(s => `<a href="${bookBase}" target="_blank" rel="noopener"
          style="display:inline-block;padding:4px 10px;border-radius:12px;background:var(--green-light);
          color:var(--green-dark);font-size:12px;font-weight:600;text-decoration:none;
          border:1px solid var(--green);white-space:nowrap">${s}</a>`).join('')
      : '<span style="color:var(--muted);font-size:12px">No times available</span>';
    return `<div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:600;margin-bottom:6px">${c.name} <span style="font-weight:400;color:var(--muted)">${c.dist?.toFixed(1)||'?'}mi</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${slotsHtml}</div>
    </div>`;
  }).join('');
}
window.loadDiscoverTeeTimes = loadDiscoverTeeTimes;
// Expose scorecard handler (called from inline onchange= in score table HTML)
window._onScoreChange = onScoreChange;
window._onBbbChange   = onBbbChange;

initAuth();

// ── Global error handler ──────────────────────────────────────────────────────
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason) || '';
  if (msg.includes('QuotaExceeded') || msg.includes('network') || msg.includes('WebChannel')) return;
  console.error('[FW]', msg);
  if (msg.includes('permission-denied')) showToast('Permission denied — try signing out and back in');
});

// ── Pre-cache Ryze scorecard data for all known courses ───────
// Runs sequentially at startup (1 course / 1.2s) so data is
// ready before the user ever taps ▶ Play GPS or 📋 Scorecard
async function _precacheRyzeCourses() {
  const key = '2a981a7029msh750d3a47e40b2acp132f2fjsnb867cef35e78';
  const courses = (window._nearbyCourses || []).map(c => c.name);
  if (!courses.length) return;
  for (const name of courses) {
    const cacheKey = 'ryze_' + name.toLowerCase().replace(/[^a-z0-9]/g,'_');
    try {
      if (sessionStorage.getItem(cacheKey)) continue; // already cached
    } catch(_) {}
    try {
      const r = await fetch(
        `https://golf-course-api.p.rapidapi.com/search?name=${encodeURIComponent(name)}`,
        { headers: { 'x-rapidapi-host': 'golf-course-api.p.rapidapi.com', 'x-rapidapi-key': key }, signal: AbortSignal.timeout(8000) }
      );
      if (r.ok) {
        const data = await r.json();
        const c = Array.isArray(data) ? data[0] : data;
        if (c?.name) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(c)); } catch(_) {}
          console.log(`[Ryze] cached: ${c.name} | ${c.scorecard?.length}h | tees: ${c.teeBoxes?.map(t=>t.tee).join(',')}`);
        }
      }
    } catch(e) { /* silent — best effort */ }
    await new Promise(r => setTimeout(r, 1200)); // 1.2s between calls
  }
}

