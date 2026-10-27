 "use strict";
const fs=require("fs"),path=require("path");
const {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,StringSelectMenuBuilder,ChannelType,PermissionFlagsBits,AttachmentBuilder,ModalBuilder,TextInputBuilder,TextInputStyle,SlashCommandBuilder}=require("discord.js");
const SERVER_NAME="💫 NOVEX RP",TIMEZONE="Europe/Berlin",COLOR=0x8052ff;
const CONFIG_FILE=path.join(__dirname,"Ticket-System.json"),DATA_FILE=path.join(__dirname,"Ticket-Daten.json"),FEEDBACK_FILE=path.join(__dirname,"Ticket-Feedback.json");
const BOT_OWNER_USER_IDS=["1322191083303731201"];
const REMINDER_INTERVAL=5*60*60*1000,TICKET_MAX_AGE=48*60*60*1000,REMINDER_CHECK_INTERVAL=5*60*1000;
const DISCORD_CATEGORIES={
 allgemeinerSupport:"1564307538881675355",teambeschwerden:"1564307542127935623",
 highteamFragen:"1564307547358498877",entbannungsantrag:"1564307540089765942",
 leitungsFragen:"1564307546129301617",muendlicheBewerbung:"1564307552194535605",
 bauGenehmigungen:"1564307549816098916",fraktionenWaffenscheine:"1564307543315058821",
 partner:"1564307548490829935",immobilien:"1564307549816098916",waffenschein:"1564307544917151785",
 contentcreator:"1564307546129301617",coowner:"1564323457209204848"
};

const ROLES = {
  founder: "1564307136069111848",
  owner: "1564307142893240490",
  coowner: "1564307143962923108",
  ownerAssistent: "1564307145359368355",
  discordLeitung: "1564307160618377257",
  developer: "1564307163092881489",

  leitendeProjektleitung: "1564307167144575087",
  projektleitung: "1564307168063131679",
  stvProjektleitung: "1564307169946509313",
  highTeamAusbilder: "1564307172261629972",

  hauptleitung: "1564307175634112634",
  stvHauptleitung: "1564307176938541236",
  gesamtleitung: "1564307181023527152",
  stvGesamtleitung: "1564307181803671673",

  highteamleitung: "1564307185469497504",
  stvHighteamleitung: "1564307186450960465",
  serverleitung: "1564307189072535583",
  stvServerleitung: "1564307191475736638",

  projektDirektor: "1564307194822795295",
  direktor: "1564307196181881032",
  stvDirektor: "1564307197893017652",

  leitenderManager: "1564307205417730050",
  manager: "1564307206655049969",
  stvManager: "1564307210455224485",

  leitendeTeamleitung: "1564307216331448437",
  teamleitung: "1564307216947744802",
  stvTeamleitung: "1564307218541711472",

  regelverwaltung: "1564307223549579417",
  stvRegelverwaltung: "1564307224959000607",

  adminLeitung: "1564307228079431941",
  modLeitung: "1564307229262221413",
  supportleitung: "1564307231955226767",
  stvSupportleitung: "1564307233511313499",

  highTeam: "1564307235457470674",
  highteamAnwaerter: "1564307237697101894",

  eventLeitung: "1564307238535831684",
  stvEventLeitung: "1564307241119645697",

  fraktionsverwaltung: "1564307243829043300",
  stvFraktionsverwaltung: "1564307245406097508",
  ausbilder: "1564307248027537429",

  seniorAdmin: "1564307253429932163",
  admin: "1564307254801469572",
  juniorAdmin: "1564307256257024102",
  testAdmin: "1564307257464725664",

  seniorMod: "1564307262690828394",
  mod: "1564307263634669732",
  juniorMod: "1564307265350140026",
  testMod: "1564307266805698721",

  seniorSup: "1564307270270058648",
  sup: "1564307271759171684",
  juniorSup: "1564307272476135536",
  testSup: "1564307283704545320",

  serverTeam: "1564307288053784706"
};
  
const ids=(...keys)=>keys.map(k=>ROLES[k]).filter(Boolean);
const ROLE_GROUPS={
 support:ids("supportleitung","stvSupportleitung","seniorSup","sup","juniorSup","testSup"),
 moderation:ids("modLeitung","seniorMod","mod","juniorMod","testMod"),
 administration:ids("adminLeitung","seniorAdmin","admin","juniorAdmin","testAdmin"),
 management:ids("leitenderManager","manager","stvManager"),
 teamleitung:ids("leitendeTeamleitung","teamleitung","stvTeamleitung"),
 projektleitung:ids("leitendeProjektleitung","projektleitung","stvProjektleitung"),
 serverleitung:ids("founder","owner","coowner","ownerAssistent","hauptleitung","stvHauptleitung","gesamtleitung","stvGesamtleitung","serverleitung","stvServerleitung"),
 fraktionsverwaltung:ids("fraktionsverwaltung","stvFraktionsverwaltung"),
 event:ids("eventLeitung","stvEventLeitung")
};
ROLE_GROUPS.highteam=[...ids("highTeam","highteamleitung","stvHighteamleitung"),...ROLE_GROUPS.teamleitung,...ROLE_GROUPS.management,...ROLE_GROUPS.projektleitung,...ROLE_GROUPS.serverleitung];
ROLE_GROUPS.leitungsebene=[...ids("projektDirektor","direktor","stvDirektor"),...ROLE_GROUPS.highteam];
ROLE_GROUPS.staff=[...ROLE_GROUPS.support,...ROLE_GROUPS.moderation,...ROLE_GROUPS.administration];
const GLOBAL_ACCESS_ROLES=ids("founder","owner","coowner","ownerAssistent","discordLeitung","developer");
const TICKET_TYPES=[
 {id:"fragen",label:"Fragen",emoji:"❓",description:"Allgemeine Fragen",categoryId:DISCORD_CATEGORIES.allgemeinerSupport,roleIds:[...ROLE_GROUPS.staff]},
 {id:"entbannung",label:"Entbannung",emoji:"🔓",description:"Antrag auf Entbannung",categoryId:DISCORD_CATEGORIES.entbannungsantrag,roleIds:[...ROLE_GROUPS.moderation,...ROLE_GROUPS.administration,...ROLE_GROUPS.event,ROLES.ausbilder]},
 {id:"anliegen",label:"Anliegen",emoji:"📝",description:"Allgemeine Anliegen",categoryId:DISCORD_CATEGORIES.allgemeinerSupport,roleIds:[ROLES.highTeam,...ROLE_GROUPS.teamleitung,...ROLE_GROUPS.management]},
 {id:"partner",label:"Partner Ticket",emoji:"🤝",description:"Partnerschaftsanfragen",categoryId:DISCORD_CATEGORIES.partner,roleIds:[...ROLE_GROUPS.management,ROLES.highTeam]},
 {id:"fraktion",label:"Fraktion",emoji:"🏢",description:"Fraktionsanliegen",categoryId:DISCORD_CATEGORIES.fraktionenWaffenscheine,roleIds:[...ROLE_GROUPS.fraktionsverwaltung]},
 {id:"immobilien",label:"Immobilien-Ticket",emoji:"🏠",description:"Immobilien, Häuser und Grundstücke",categoryId:DISCORD_CATEGORIES.immobilien,roleIds:[...ROLE_GROUPS.fraktionsverwaltung]},
 {id:"waffenschein",label:"Waffenschein",emoji:"📋",description:"Waffenschein beantragen",categoryId:DISCORD_CATEGORIES.waffenschein,roleIds:[...ROLE_GROUPS.fraktionsverwaltung]},
 {id:"contentcreator",label:"Content Creator",emoji:"🎨",description:"Content-Creator-Anfragen",categoryId:DISCORD_CATEGORIES.contentcreator,roleIds:[ROLES.hauptleitung,ROLES.direktor,ROLES.highTeamAusbilder,...ROLE_GROUPS.projektleitung]},
 {id:"serverwechsel",label:"Server Wechsel",emoji:"🔄",description:"Anfrage zum Serverwechsel",categoryId:DISCORD_CATEGORIES.leitungsFragen,roleIds:[...ROLE_GROUPS.projektleitung,ROLES.owner,ROLES.coowner,ROLES.founder]},
 {id:"beschwerde",label:"Generelle Beschwerden",emoji:"⚠️",description:"Allgemeine Beschwerden",categoryId:DISCORD_CATEGORIES.teambeschwerden,roleIds:[ROLES.highTeam,...ROLE_GROUPS.teamleitung,...ROLE_GROUPS.management,ROLES.hauptleitung,ROLES.direktor,ROLES.highTeamAusbilder]},
 {id:"teambeschwerde",label:"Team Beschwerde",emoji:"📢",description:"Beschwerde über Teammitglieder",categoryId:DISCORD_CATEGORIES.teambeschwerden,roleIds:[ROLES.highTeam,...ROLE_GROUPS.management,ROLES.direktor]},
 {id:"coowner",label:"Co-Owner / Owner",emoji:"🏛️",description:"Kontakt zu Owner und Co.Owner",categoryId:DISCORD_CATEGORIES.coowner,roleIds:ids("owner","coowner")},
 {id:"intern",label:"Intern",emoji:"🔒",description:"Interne Angelegenheiten",categoryId:DISCORD_CATEGORIES.highteamFragen,roleIds:[...ROLE_GROUPS.projektleitung,ROLES.owner,ROLES.coowner,ROLES.founder]},
 {id:"highteam",label:"High Team",emoji:"👑",description:"Kontakt zum High Team",categoryId:DISCORD_CATEGORIES.highteamFragen,roleIds:ids("highTeam","highteamleitung","stvHighteamleitung")}
];
function readJSON(file,fallback){try{return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")):fallback;}catch(e){console.error("[TICKET] JSON lesen:",e);return fallback;}}
function writeJSON(file,data){try{const tmp=file+".tmp";fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,file);return true;}catch(e){console.error("[TICKET] JSON speichern:",e);return false;}}
function loadData(){const d=readJSON(DATA_FILE,{tickets:{}});d.tickets ||= {};return d;}
const saveData=write=>writeJSON(DATA_FILE,write);
function getGuildConfig(id){const d=readJSON(CONFIG_FILE,{guilds:{}});return {logChannelId:null,feedbackChannelId:null,nightLock:true,name:SERVER_NAME,...(d.guilds?.[id]||{})};}
function saveGuildConfig(id,c){const d=readJSON(CONFIG_FILE,{guilds:{}});d.guilds ||= {};d.guilds[id]=c;return writeJSON(CONFIG_FILE,d);}
function getBerlinHour(){return Number(new Intl.DateTimeFormat("en-GB",{timeZone:TIMEZONE,hour:"numeric",hourCycle:"h23"}).format(new Date()));}
function isNightLock(c){return c.nightLock!==false&&getBerlinHour()<8;}
const getTicketType=id=>TICKET_TYPES.find(t=>t.id===id);
const uniqueIds=a=>[...new Set(a.filter(Boolean))];
const getTicketRoleIds=(g,id)=>uniqueIds(getTicketType(id)?.roleIds||[]).filter(x=>g.roles.cache.has(x));
const getGlobalRoleIds=g=>GLOBAL_ACCESS_ROLES.filter(x=>g.roles.cache.has(x));
function isGlobalStaff(m){return !!m&&(m.id===m.guild.ownerId||BOT_OWNER_USER_IDS.includes(m.id)||GLOBAL_ACCESS_ROLES.some(x=>m.roles.cache.has(x)));}
function isStaff(m,id){return !!m&&(isGlobalStaff(m)||(getTicketType(id)?.roleIds||[]).some(x=>m.roles.cache.has(x)));}
const getDisplayName=m=>m.displayName||m.user?.globalName||m.user?.username||"Unbekannt";
function buildPanel(g,c){
 const e=new EmbedBuilder().setColor(COLOR).setTitle("💫 NOVEX RP • SUPPORT HUB").setDescription(["**Willkommen beim NOVEX-RP-Support!**","","Du benötigst Hilfe oder möchtest ein vertrauliches Anliegen klären?","Drücke **Support anfragen** und wähle eine Ticketart.","","🔐 Private Tickets mit zuständigen Teamrollen.",c.nightLock!==false?"🌙 Ticketzeiten: 08:00–00:00 Uhr":"🟢 Tickets rund um die Uhr"].join("\n")).setFooter({text:`${c.name||SERVER_NAME} • Support`}).setTimestamp();
 return {embeds:[e],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("ticket_open").setLabel("Support anfragen").setEmoji("💌").setStyle(ButtonStyle.Primary))]};
}
function buildTicketSelect(){
 const select=new StringSelectMenuBuilder().setCustomId("ticket_select").setPlaceholder("📂 Ticket-Kategorie wählen").addOptions(TICKET_TYPES.map(t=>({label:t.label,value:t.id,description:t.description,emoji:t.emoji})));
 return {embeds:[new EmbedBuilder().setColor(COLOR).setTitle("🎫 Ticketart auswählen").setDescription("Wähle dein Anliegen aus.")],components:[new ActionRowBuilder().addComponents(select),new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("ticket_cancel").setLabel("Abbrechen").setStyle(ButtonStyle.Secondary))],flags:64};
}
function ticketButtons(claimed=false){return new ActionRowBuilder().addComponents(
 new ButtonBuilder().setCustomId("ticket_claim").setLabel("Übernehmen").setEmoji("🙋").setStyle(ButtonStyle.Success).setDisabled(claimed),
 new ButtonBuilder().setCustomId("ticket_release").setLabel("Freigeben").setEmoji("🔓").setStyle(ButtonStyle.Secondary).setDisabled(!claimed),
 new ButtonBuilder().setCustomId("ticket_close").setLabel("Schließen").setEmoji("🔒").setStyle(ButtonStyle.Danger));}
function describeFailure(r){return {night:"🌙 Zwischen 00:00 und 08:00 Uhr können keine Tickets erstellt werden.",exists:`📌 Du hast bereits ein offenes Ticket: <#${r?.channelId}>`,nosetup:"⚠️ Die Discord-Kategorie konnte nicht gefunden werden.",permission:"❌ Bot-Berechtigungen fehlen."}[r?.reason]||"❌ Ticket konnte nicht erstellt werden.";}
async function findOpenTicket(g,userId){
 const d=loadData();let changed=false;
 for(const [id,t] of Object.entries(d.tickets)){if(t.guildId!==g.id||t.userId!==userId)continue;
 const ch=await g.channels.fetch(id).catch(()=>null);if(ch)return id;delete d.tickets[id];changed=true;}
 if(changed)saveData(d);return null;
}
async function sendLog(g,c,e,files=[]){if(!c.logChannelId)return;const ch=await g.channels.fetch(c.logChannelId).catch(()=>null);if(ch?.isTextBased())await ch.send({embeds:[e],files,allowedMentions:{parse:[]}}).catch(err=>console.error("[TICKET] Log:",err));}
function channelName(type,member){
 // Emoji + Ticketart + Benutzername; Discord begrenzt Kanalnamen auf 100 Zeichen.
 const label=type.label.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
 const user=member.user.username.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9_-]+/g,"-").replace(/^-|-$/g,"").slice(0,28)||member.id;
 return `${type.emoji}・${label}・${user}`.slice(0,95);
}
async function createTicket(g,m,typeId,options={}){
 try{
  const type=getTicketType(typeId);if(!type)return {ok:false,reason:"error"};
  const config=getGuildConfig(g.id);if(isNightLock(config))return {ok:false,reason:"night"};
  const existing=await findOpenTicket(g,m.id);if(existing)return {ok:false,reason:"exists",channelId:existing};
  const parent=await g.channels.fetch(type.categoryId).catch(()=>null);
  if(parent?.type!==ChannelType.GuildCategory)return {ok:false,reason:"nosetup"};
  const staff=getTicketRoleIds(g,type.id),allRoles=uniqueIds([...staff,...getGlobalRoleIds(g)]);
  const allow=[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles];
  const overwrites=[{id:g.id,deny:[PermissionFlagsBits.ViewChannel]},{id:m.id,allow},{id:g.client.user.id,allow:[...allow,PermissionFlagsBits.ManageChannels]},...allRoles.map(id=>({id,allow}))];
  for(const id of BOT_OWNER_USER_IDS){if(id!==m.id&&id!==g.client.user.id&&await g.members.fetch(id).catch(()=>null))overwrites.push({id,allow});}
  const ch=await g.channels.create({name:channelName(type,m),type:ChannelType.GuildText,parent:parent.id,topic:`NOVEX ticket | ${m.id} | ${type.id}`,permissionOverwrites:overwrites});
  const d=loadData();d.tickets[ch.id]={guildId:g.id,userId:m.id,type:type.id,categoryId:parent.id,createdAt:Date.now(),claimedBy:null,lastReminder:null,source:options.source||"panel"};
  if(!saveData(d)){await ch.delete().catch(()=>{});return {ok:false,reason:"error"};}
  const e=new EmbedBuilder().setColor(COLOR).setTitle(`${type.emoji} ${type.label}`).setDescription(`Hallo **${getDisplayName(m)}**!\n\n📝 Beschreibe bitte dein Anliegen.\n🔔 Das zuständige Team wurde benachrichtigt.\n⏳ Ein Teammitglied meldet sich bald.`).addFields({name:"👤 Ersteller",value:getDisplayName(m),inline:true},{name:"📂 Kategorie",value:type.label,inline:true},{name:"📌 Status",value:"🟡 Offen",inline:true}).setFooter({text:`${SERVER_NAME} • Support`}).setTimestamp();
  if(options.question)e.addFields({name:"❓ Frage",value:String(options.question).slice(0,1000)});
  await ch.send({content:staff.map(id=>`<@&${id}>`).join(" ")||"🎫 Neues Ticket",embeds:[e],components:[ticketButtons()],allowedMentions:{parse:[],roles:staff,users:[]}});
  await sendLog(g,config,new EmbedBuilder().setColor(0x57f287).setTitle("🎫 Ticket erstellt").addFields({name:"Ersteller",value:`<@${m.id}>`},{name:"Ticketart",value:type.label},{name:"Kanal",value:`<#${ch.id}>`}).setTimestamp());
  return {ok:true,channel:ch};
 }catch(e){console.error("[TICKET] Erstellen:",e);return {ok:false,reason:"error"};}
}
async function buildTranscript(ch){
 const messages=[];let before;
 for(let i=0;i<10;i++){const batch=await ch.messages.fetch({limit:100,...(before?{before}:{})});if(!batch.size)break;messages.push(...batch.values());before=batch.last().id;if(batch.size<100)break;}
 messages.sort((a,b)=>a.createdTimestamp-b.createdTimestamp);
 return messages.map(m=>`[${new Date(m.createdTimestamp).toLocaleString("de-DE",{timeZone:TIMEZONE})}] ${m.author?.username||"Unbekannt"}: ${m.content||"[Embed/Datei]"} ${[...m.attachments.values()].map(a=>a.url).join(", ")}`).join("\n");
}
const closingTickets=new Set();
async function closeTicketWithFeedback(ch,t,reason,closedBy){
 if(!ch||closingTickets.has(ch.id))return false;closingTickets.add(ch.id);
 try{
  const config=getGuildConfig(ch.guild.id),typeName=getTicketType(t.type)?.label||t.type;
  const feedback=readJSON(FEEDBACK_FILE,{entries:{},owners:{},tickets:{}});
  feedback.entries ||= {};feedback.owners ||= {};feedback.tickets ||= {};
  feedback.owners[ch.id]=t.userId;feedback.tickets[ch.id]={guildId:ch.guild.id,type:typeName,claimedBy:t.claimedBy||null,closedBy:String(closedBy),closedAt:Date.now()};
  writeJSON(FEEDBACK_FILE,feedback);
  const user=await ch.client.users.fetch(t.userId).catch(()=>null);
  if(user){
   const row=new ActionRowBuilder().addComponents(...[1,2,3,4,5].map(n=>new ButtonBuilder().setCustomId(`ticket_feedback_star_${n}_${ch.id}`).setLabel("⭐".repeat(n)).setStyle(ButtonStyle.Primary)));
   await user.send({embeds:[new EmbedBuilder().setColor(0x0893f3).setTitle("💙 NOVEX RP • Support-Bewertung").setDescription("🔒 Dein Ticket wurde geschlossen.\n\nWie zufrieden warst du mit unserem Support? Wähle 1–5 Sterne und gib deinen Grund an.").addFields({name:"🎫 Ticketart",value:typeName},{name:"👨‍💻 Bearbeitet von",value:t.claimedBy?`<@${t.claimedBy}>`:"Nicht übernommen"}).setTimestamp()],components:[row],allowedMentions:{parse:[]}}).catch(()=>{});
  }
  const log=new EmbedBuilder().setColor(0xed4245).setTitle("🔒 Ticket geschlossen").addFields({name:"Ersteller",value:`<@${t.userId}>`},{name:"Ticketart",value:typeName},{name:"Geschlossen von",value:String(closedBy).slice(0,1024)},{name:"Grund",value:String(reason).slice(0,1024)}).setTimestamp();
  if(config.logChannelId){try{const transcript=await buildTranscript(ch);await sendLog(ch.guild,config,log,[new AttachmentBuilder(Buffer.from(transcript||"Keine Nachrichten","utf8"),{name:`transcript-${ch.id}.txt`})]);}catch(e){console.error("[TICKET] Transcript:",e);await sendLog(ch.guild,config,log);}}
  const d=loadData();delete d.tickets[ch.id];if(!saveData(d))return false;
  await ch.send({embeds:[new EmbedBuilder().setColor(0xed4245).setTitle("🔒 Ticket geschlossen").setDescription(`${reason}\n\nDer Kanal wird in 5 Sekunden gelöscht.`)]}).catch(()=>{});
  setTimeout(()=>ch.delete(reason).catch(console.error),5000);return true;
 }finally{closingTickets.delete(ch.id);}
}
async function handleTicketFeedback(i){
 if(!i.isButton()&&!i.isModalSubmit())return;
 const b=/^ticket_feedback_star_([1-5])_(\d+)$/.exec(i.customId||""),m=/^ticket_feedback_modal_([1-5])_(\d+)$/.exec(i.customId||"");
 if(!b&&!m)return;const [,stars,chId]=b||m,rate=Number(stars),f=readJSON(FEEDBACK_FILE,{entries:{},owners:{},tickets:{}});f.entries ||= {};f.owners ||= {};f.tickets ||= {};
 const key=`${chId}:${i.user.id}`;
 if(f.owners[chId]!==i.user.id)return i.reply({content:"🔒 Nicht deine Bewertung.",flags:64});
 if(f.entries[key])return i.reply({content:"ℹ️ Bereits bewertet.",flags:64});
 if(b){const modal=new ModalBuilder().setCustomId(`ticket_feedback_modal_${rate}_${chId}`).setTitle("💙 NOVEX RP • Bewertung");modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("ticket_feedback_reason").setLabel("Grund für deine Bewertung").setStyle(TextInputStyle.Paragraph).setMinLength(2).setMaxLength(1000).setRequired(true)));return i.showModal(modal);}
 await i.deferReply({flags:64});const reason=i.fields.getTextInputValue("ticket_feedback_reason").trim();if(reason.length<2)return i.editReply("❌ Bitte Grund angeben.");
 const latest=readJSON(FEEDBACK_FILE,{entries:{},owners:{},tickets:{}});latest.entries ||= {};if(latest.entries[key])return i.editReply("ℹ️ Bereits bewertet.");
 const info=latest.tickets?.[chId]||{};latest.entries[key]={ticketChannelId:chId,guildId:info.guildId||null,userId:i.user.id,stars:rate,reason,claimedBy:info.claimedBy||null,ratedAt:Date.now()};
 if(!writeJSON(FEEDBACK_FILE,latest))return i.editReply("❌ Speichern fehlgeschlagen.");
 const guild=info.guildId?await i.client.guilds.fetch(info.guildId).catch(()=>null):null;
 if(guild){const c=getGuildConfig(guild.id);if(c.feedbackChannelId){const channel=await guild.channels.fetch(c.feedbackChannelId).catch(()=>null);if(channel?.isTextBased())await channel.send({embeds:[new EmbedBuilder().setColor(0x0893f3).setTitle("💙 NOVEX RP • Support-Bewertung").addFields({name:"👤 Von",value:`<@${i.user.id}>`},{name:"⭐ Sterne",value:`${"⭐".repeat(rate)} (${rate}/5)`},{name:"🛠️ Staff",value:info.claimedBy?`<@${info.claimedBy}>`:"Nicht übernommen"},{name:"📝 Grund",value:reason}).setTimestamp()],allowedMentions:{parse:[]}}).catch(console.error);}}
 await i.editReply(`💙 Danke für dein Feedback! ${rate}/5 Sterne.`);
 if(i.message?.editable)await i.message.edit({components:[]}).catch(()=>{});
}
async function handleTicketInteraction(i){
 if(!i.guild||!i.customId?.startsWith("ticket_"))return;
 try{
  const id=i.customId,c=getGuildConfig(i.guild.id);
  if(i.isButton()&&id==="ticket_immobilien_open"){await i.deferReply({flags:64});const m=await i.guild.members.fetch(i.user.id);const r=await createTicket(i.guild,m,"immobilien",{source:"immobilien-panel"});return i.editReply(r.ok?`✅ Dein Ticket: <#${r.channel.id}>`:describeFailure(r));}
  if(i.isButton()&&id==="ticket_open"){if(isNightLock(c))return i.reply({content:describeFailure({reason:"night"}),flags:64});const old=await findOpenTicket(i.guild,i.user.id);if(old)return i.reply({content:describeFailure({reason:"exists",channelId:old}),flags:64});return i.reply(buildTicketSelect());}
  if(i.isButton()&&id==="ticket_cancel")return i.update({content:"❌ Abgebrochen.",embeds:[],components:[]});
  if(i.isStringSelectMenu()&&id==="ticket_select"){await i.deferUpdate();const m=await i.guild.members.fetch(i.user.id);const r=await createTicket(i.guild,m,i.values[0]);return i.editReply({content:r.ok?`✅ Ticket erstellt: <#${r.channel.id}>`:describeFailure(r),embeds:[],components:[]});}
  if(!i.isButton()||!["ticket_claim","ticket_release","ticket_close"].includes(id))return;
  const d=loadData(),t=d.tickets[i.channelId];if(!t)return i.reply({content:"❌ Kein aktives Ticket.",flags:64});
  const m=await i.guild.members.fetch(i.user.id);if(!isStaff(m,t.type))return i.reply({content:"🔒 Nur zuständige Teammitglieder dürfen dieses Ticket bearbeiten.",flags:64});
  if(id==="ticket_claim"){
   if(t.claimedBy)return i.reply({content:"⚠️ Bereits übernommen.",flags:64});
   t.claimedBy=i.user.id;if(!saveData(d))return i.reply({content:"❌ Speichern fehlgeschlagen.",flags:64});
   await i.update({components:[ticketButtons(true)]});return i.channel.send({embeds:[new EmbedBuilder().setColor(0x57f287).setTitle("🙋 Ticket übernommen!").setDescription(`**${getDisplayName(m)}** kümmert sich jetzt um dein Anliegen.`).setTimestamp()]});
  }
  if(id==="ticket_release"){
   if(!t.claimedBy)return i.reply({content:"⚠️ Noch nicht übernommen.",flags:64});
   if(t.claimedBy!==i.user.id&&!isGlobalStaff(m))return i.reply({content:"🔒 Nur die übernehmende Person oder die Leitung darf freigeben.",flags:64});
   t.claimedBy=null;t.lastReminder=Date.now();if(!saveData(d))return i.reply({content:"❌ Speichern fehlgeschlagen.",flags:64});
   await i.update({components:[ticketButtons(false)]});return i.channel.send({embeds:[new EmbedBuilder().setColor(0xf1c40f).setTitle("🔓 Ticket freigegeben").setDescription(`**${getDisplayName(m)}** hat das Ticket wieder freigegeben.`)]});
  }
  await i.deferReply({flags:64});const ok=await closeTicketWithFeedback(i.channel,t,"Manuell durch das Support-Team geschlossen",getDisplayName(m));return i.editReply(ok?"✅ Ticket geschlossen; Feedback-DM wurde versucht.":"❌ Ticket konnte nicht geschlossen werden.");
 }catch(e){console.error("[TICKET] Interaktion:",e);const payload={content:"❌ Fehler im Ticketsystem.",flags:64};if(i.deferred||i.replied)await i.followUp(payload).catch(()=>{});else await i.reply(payload).catch(()=>{});}
}
async function handleTicketSlashCommand(i){
 if(!i.isChatInputCommand()||i.commandName!=="ticketsystem")return;
 if(!i.guild||!i.channel?.isTextBased())return i.reply({content:"❌ Nur auf Servern.",flags:64});
 if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return i.reply({content:"🔒 Server verwalten erforderlich.",flags:64});
 try{await i.deferReply({flags:64});await i.channel.send(buildPanel(i.guild,getGuildConfig(i.guild.id)));await i.editReply("✅ Ticketpanel erstellt!");}catch(e){console.error("[TICKET] Panel:",e);if(i.deferred)await i.editReply("❌ Panel konnte nicht erstellt werden.").catch(()=>{});}
}
async function handleImmobilienPanelSlashCommand(i){
 if(!i.isChatInputCommand()||i.commandName!=="immobilienpanel")return;
 if(!i.guild||!i.channel?.isTextBased())return i.reply({content:"❌ Nur auf Servern.",flags:64});
 if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return i.reply({content:"🔒 Server verwalten erforderlich.",flags:64});
 try{await i.deferReply({flags:64});await i.channel.send({embeds:[new EmbedBuilder().setColor(0x0893f3).setTitle("🏠 NOVEX RP • Immobilien-Service").setDescription("Klicke auf den Button für ein privates Immobilien-Ticket.")],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("ticket_immobilien_open").setLabel("Immobilien-Ticket erstellen").setEmoji("🏠").setStyle(ButtonStyle.Primary))]});await i.editReply("✅ Immobilien-Panel erstellt.");}catch(e){console.error(e);if(i.deferred)await i.editReply("❌ Fehler.").catch(()=>{});}
}
async function handleTicketSetupSlashCommand(i){
 if(!i.isChatInputCommand()||i.commandName!=="ticketsetup")return;
 if(!i.guild||!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return i.reply({content:"🔒 Server verwalten erforderlich.",flags:64});
 try{await i.deferReply({flags:64});const sub=i.options.getSubcommand(),c=getGuildConfig(i.guild.id);
 if(sub==="log"||sub==="bewertungen"){const ch=i.options.getChannel("kanal",true);if(!ch.isTextBased()||ch.isDMBased())return i.editReply("❌ Server-Textkanal wählen.");if(sub==="log")c.logChannelId=ch.id;else c.feedbackChannelId=ch.id;}
 else if(sub==="nachtsperre")c.nightLock=i.options.getString("status",true)==="an";
 else if(sub==="name")c.name=i.options.getString("text",true);
 else if(sub==="status")return i.editReply(`**🎫 NOVEX RP Ticketsystem**\n📂 Ticketarten: ${TICKET_TYPES.length}\n📋 Logs: ${c.logChannelId?`<#${c.logChannelId}>`:"Nicht gesetzt"}\n⭐ Bewertungen: ${c.feedbackChannelId?`<#${c.feedbackChannelId}>`:"Nicht gesetzt"}\n🌙 Nachtsperre: ${c.nightLock?"An":"Aus"}`);
 else return i.editReply("❌ Unbekannter Befehl.");
 return i.editReply(saveGuildConfig(i.guild.id,c)?"✅ Einstellung gespeichert.":"❌ Speichern fehlgeschlagen.");
 }catch(e){console.error("[TICKET] Setup:",e);if(i.deferred)await i.editReply("❌ Fehler.").catch(()=>{});}
}
async function runReminders(client){
 const d=loadData(),now=Date.now();let changed=false;
 for(const [id,t] of Object.entries(d.tickets)){
  if(closingTickets.has(id))continue;
  const ch=await client.channels.fetch(id).catch(()=>null);
  if(!ch?.isTextBased()||!ch.guild){delete d.tickets[id];changed=true;continue;}
  if(now-t.createdAt>=TICKET_MAX_AGE){if(await closeTicketWithFeedback(ch,t,"Automatisch nach 48 Stunden geschlossen","Automatisches Ticketsystem")){delete d.tickets[id];changed=true;}continue;}
  if(now-(t.lastReminder||t.createdAt)<REMINDER_INTERVAL)continue;
  try{
   if(t.claimedBy)await ch.send({content:`⏰ Ticket-Erinnerung: Zuständig <@${t.claimedBy}> · Ersteller <@${t.userId}>`,allowedMentions:{parse:[],users:[t.claimedBy,t.userId]}});
   else{const roles=getTicketRoleIds(ch.guild,t.type);await ch.send({content:`⏰ Dieses Ticket wartet auf Übernahme.\n👤 <@${t.userId}>\n📢 ${roles.map(r=>`<@&${r}>`).join(" ")||"Zuständiges Team"}`,allowedMentions:{parse:[],users:[t.userId],roles}});}
   t.lastReminder=now;changed=true;
  }catch(e){console.error("[TICKET] Erinnerung:",e);}
 }
 if(changed)saveData(d);
}
const slashCommands=[
 new SlashCommandBuilder().setName("ticketsystem").setDescription("NOVEX RP Ticketpanel erstellen").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 new SlashCommandBuilder().setName("immobilienpanel").setDescription("NOVEX RP Immobilienpanel erstellen").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 new SlashCommandBuilder().setName("ticketsetup").setDescription("NOVEX RP Ticketsystem konfigurieren").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
 .addSubcommand(s=>s.setName("log").setDescription("Ticket-Logkanal").addChannelOption(o=>o.setName("kanal").setDescription("Textkanal").addChannelTypes(ChannelType.GuildText).setRequired(true)))
 .addSubcommand(s=>s.setName("bewertungen").setDescription("Bewertungskanal").addChannelOption(o=>o.setName("kanal").setDescription("Textkanal").addChannelTypes(ChannelType.GuildText).setRequired(true)))
 .addSubcommand(s=>s.setName("nachtsperre").setDescription("Nachtsperre").addStringOption(o=>o.setName("status").setDescription("Status").setRequired(true).addChoices({name:"An",value:"an"},{name:"Aus",value:"aus"})))
 .addSubcommand(s=>s.setName("name").setDescription("Panelname").addStringOption(o=>o.setName("text").setDescription("Name").setRequired(true)))
 .addSubcommand(s=>s.setName("status").setDescription("Aktuelle Konfiguration"))
];
let initialized=false;
function initializeTicketSystem(client){
 if(initialized)return;if(!client)throw new Error("Discord-Client fehlt.");
 initialized=true;
 client.on("interactionCreate",handleTicketInteraction);
 client.on("interactionCreate",handleTicketSlashCommand);
 client.on("interactionCreate",handleImmobilienPanelSlashCommand);
 client.on("interactionCreate",handleTicketFeedback);
 client.on("interactionCreate",handleTicketSetupSlashCommand);
 async function register(){for(const guild of client.guilds.cache.values()){try{for(const cmd of slashCommands)await guild.commands.create(cmd.toJSON());}catch(e){console.error("[TICKET] Slash-Registrierung:",e);}}}
 if(client.isReady()){void register();void runReminders(client);}else client.once("clientReady",()=>{void register();void runReminders(client);});
 client.on("guildCreate",async g=>{for(const cmd of slashCommands)await g.commands.create(cmd.toJSON()).catch(console.error);});
 const timer=setInterval(()=>{if(client.isReady())runReminders(client).catch(console.error);},REMINDER_CHECK_INTERVAL);timer.unref?.();
 console.log("✅ NOVEX RP Ticketsystem geladen (/ticketsystem, /ticketsetup, /immobilienpanel).");
}
module.exports={initializeTicketSystem,createTicket,describeFailure,TICKET_TYPES,DISCORD_CATEGORIES,ROLES,ROLE_GROUPS};