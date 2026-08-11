import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://sviyyznwdjenbtqkmues.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2aXl5em53ZGplbmJ0cWttdWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODI1MTAsImV4cCI6MjA5MzE1ODUxMH0.jKoEFQ1CzmBWOrb3T_y9CXKvqobu_AEIoA2plk0mCIE";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const dataString = `Mobile Number	SYS Code	Partener ID	Insur. Comp	Structure Company	Maxer ID	National id	Name En.	Name Ar.	Site	Gender	Hiring Date
1200072473	1111	2680	MAXAB	MAXAB	103612	29104141600094	Mohamed Ahmed Abo Shnady	محمد احمد ابراهيم احمد ابوشنادى	Tanta	Male	1 July 2021
1143626182	1120	2699	MAXAB	MAXAB	103625	28908222401698	Omar Amroh Abdel Fadeel Abdel Khalek	عمر امره عبدالفضيل عبدالخالق	Menia	Male	1 July 2021
1069108406	1334	2826	MAXAB	MAXAB	103883	29601201601439	Ahmed Atef Mohamed Gamel	احمد عاطف محمد جميل	El Mahala	Male	1 July 2021
1141525364	2026	4470	MAXAB	MAXAB	110313	29103032402715	Abd El Rahman Roshdy Mohamed	عبدالرحمن رشدى ابراهيم حمد	Menia	Male	25 December 2021
1065049063	2312	5175	MAXAB	MAXAB	118954	29505202406355	Muhammed Salah Hassan Gamal	محمد صلاح حسن جمال	Menia	Male	3 February 2022
1062974785	2460	5605	MAXAB	MAXAB	122672	29401271301077	Ahmed Mohammed Soliman	احمد محمد محمد سليمان	Sharqya	Male	21 February 2022
1284506709	2641	6036	MAXAB	MAXAB	122748	29101201604176	Mohamed Talaat Hamed	محمد طلعت حامد عباس	Mansoura	Male	10 March 2022
1202402824	2650	6051	MAXAB	MAXAB	122678	29809161301291	Mohammed Saeid Elmoamly	محمد سعيد محمود المعاملى	Sharqya	Male	12 March 2022
1000758907	2974	6760	MAXAB	MAXAB	126768	29105191600652	Ibrahim El Sayed Ezz	ابراهيم السيد ابراهيم عز	El Mahala	Male	6 April 2022
1016455846	3081	7110	MAXAB	MAXAB	126734	29309112405097	Diaa Abdel Rahim Ahmed Mohamed	ضياء عبدالرحيم احمد محمد	Menia	Male	14 April 2022
1003980804	3088	7143	MAXAB	MAXAB	126754	29707111700791	Mohamed Reda El Desoky Mohamed	محمد رضا الدسوقى محمد	Tanta	Male	14 April 2022
1012519075	5061	14450	MAXAB	MAXAB	133850	29611012404938	Muhammad Mahmoud Muhammad Madi	محمد محمود محمد ماضى	Menia	Male	27 May 2023
1012728993	4940	14052	MAXAB	MAXAB	134648	29804012505214	Ziad Ali Hassan Abdel Rahim	زياد على حسن عبدالرحيم	Assiut	Male	26 August 2023
1090390121	5871	17571	MAXAB	MAXAB	135188	29802242401172	Mahmoud Abdel Basset Ali Hassan	محمود عبدالباسط على حسن	Menia	Male	21 January 2024
1090682698	2975	6761	MAXAB	MAXAB	126747	28704301600316	Ramdan Mohamed Zaki	رمضان محمد زكى رمضان	Tanta	Male	21 February 2024
1272474537	965	2422	LAAS	MAXAB	101978	29404181600198	Ali Ahmed Ali Ahmed Abdel Aziz	على احمد على احمد عبدالعزيز	Tanta	Male	12 January 2021
1288117362	29023	29023	LAAS	MAXAB	103338	27610051202214	Mohammed Mohammed Ahmed El Ghareeb	محمد محمد احمد الغريب	Mansoura	Male	1 April 2021
1009171238	1115	2688	LAAS	MAXAB	103613	29101111600252	Sherif Ibrahim El Dosouky	شريف ابراهيم ابراهيم الدسوقى	El Mahala	Male	1 July 2021
1212422446	1375	2928	LAAS	MAXAB	103891	29607011318372	Refaat Magdy Refaat Abbas	رفعت مجدى رفعت عباس	Sharqya	Male	1 July 2021
1006181868	1380	2943	LAAS	MAXAB	103893	29008111300976	Magdy Hamdy Rezk Hassan	مجدى حمدى رزق حسن	Sharqya	Male	16 July 2021
1060929507	1400	3020	LAAS	MAXAB	104158	29706261300591	Abdelhameed Khaled Mohamed	عبدالحميد خالد عبدالحميد محمد	Sharqya	Male	1 August 2021
1286020957	1500	3321	LAAS	MAXAB	104388	29009221301974	Fawzy Salah Saad Aly	فوزى صلاح سعد على على	Sharqya	Male	1 October 2021
1141980890	1634	3568	LAAS	MAXAB	104756	29503201302634	Reda Ossama Abdelaziz Hamed	رضا اسامه عبدالعزيز حامد	Sharqya	Male	2 November 2021
1153912621	1875	4017	LAAS	MAXAB	104937	29003201301112	Elsayed Nabil Elsayed Mansour	السيد نبيل السيد منصور	Sharqya	Male	15 December 2021
1094709572	1882	4036	LAAS	MAXAB	103386	29307201202237	Karim Helmy Abd El Sayed	كريم حلمى عيد السيد على	Mansoura	Male	1 January 2022
1014597056	2075	4589	LAAS	MAXAB	110018	28704041301514	Ahmed Elsayed Abdelsalam Mohamed Ibrahim	احمد السيد عبدالسلام محمد	Sharqya	Male	6 January 2022
1273220349	2337	5222	LAAS	MAXAB	118963	29111291600218	Mohamed Metwaly Youssif	محمد متولى يوسف متولى حسين	Tanta	Male	5 February 2022
1148032407	2445	5565	LAAS	MAXAB	118958	29703192401895	Abdel Rahman Mostafa Nage Ahmed	عبدالرحمن مصطفى ناجى احمد	Menia	Male	20 February 2022
1270581211	2613	5944	LAAS	MAXAB	122719	29902171600459	Mohamed Essam Al0Dalal	محمد عصام رأفت الدلال	El Mahala	Male	9 March 2022
1024997524	2789	6346	LAAS	MAXAB	122701	30007231601278	Mohamed Mohamed El Shenawy	محمد محمود محمد الشناوى	Tanta	Male	15 March 2022
1289989111	2708	6193	LAAS	MAXAB	122731	29712011602818	Mahmoud Raafat Zaki	محمود رأفت زكى يحيى	El Mahala	Male	16 March 2022
1144481768	2829	6414	LAAS	MAXAB	126744	29702031600638	Mohamed El Sayed Mohamed Hekaal	محمد السيد اسماعيل محمد هيكل	Tanta	Male	21 March 2022
1067250812	2884	6539	LAAS	MAXAB	126758	29109011613579	Ahmed Nabawy Abdallah	احمد نبوى عبدالله قنديل	El Mahala	Male	27 March 2022
1274109698	3158	7440	LAAS	MAXAB	128945	28902011602451	Imam Hassan Imam	الامام حسن الامام حاتم	El Mahala	Male	7 April 2022
1225971086	3643	9175	LAAS	MAXAB	131425	29909040400211	Hamdy Mohamed Hanfy	حمدى محمد حنفى عبدالحميد ابراهيم	Bani Sweif	male	21 August 2022
1003739541	3653	9221	LAAS	MAXAB	131426	29502092501013	Mohamed Hassan Taher Ahmed	محمد حسن طاهر احمد	Assiut	Male	21 August 2022
1112535422	3655	9228	LAAS	MAXAB	131427	28502122502598	Moustafa Abdelmawgod Ismail Sayed	مصطفى عبدالموجود اسماعيل سيد	Assiut	Male	21 August 2022
1116152211	4360	12095	LAAS	MAXAB	131994	29401152504172	Ismail Abdel Rahman Younis Omar	إسماعيل عبد الرحمن يونس عمر	Assiut	Male	21 October 2022
1144345313	4361	12100	LAAS	MAXAB	132137	29801102503815	Mahmoud Mostafa Rashed Mostafa	محمود مصطفى راشد مصطفى	Assiut	Male	21 October 2022
1014577230	4554	12927	LAAS	MAXAB	131932	29106012506157	Ashraf Farghaly Tawfik Mgaly	اشرف فرغلى توفيق مجلى	Assiut	Male	15 November 2022
1151310767	4616	13189	LAAS	MAXAB	132534	29602012612132	Mahmoud Abdel Rahim Atta Abdel Rahim	محمود عبدالرحيم عطا عبدالرحيم	Sohag	Male	21 November 2022
1002864551	4619	13199	LAAS	MAXAB	132537	29608062600176	Mohamed Abdel Hamed Mahmoud Ahmed	محمد عبدالحميد محمود احمد	Sohag	Male	21 November 2022
1068118250	4587	13066	LAAS	MAXAB	132538	29209252501253	Abu El Hassan  Shaarawy Araby Ahmed	ابوالحسن شعراوى عربى احمد	Assiut	Male	21 November 2022
1020063995	4195	11262	LAAS	MAXAB	132541	29306062400171	Abdelrahman Mohamed Mohamed Khedr	عبدالرحمن محمد محمد خضر	Menia	Male	5 December 2022
1552426691	4177	11189	LAAS	MAXAB	133086	29704011602131	Ibrahim Adel Mostafa Elaabd	ابراهيم عادل ابراهيم العبد	Tanta	Male	1 January 2023
1009899773	4290	11630	LAAS	MAXAB	133087	29801011626019	Ahmed Mohamed Fared Salem	احمد محمد فريد سالم	Tanta	Male	1 January 2023
1282441031	4902	13924	LAAS	MAXAB	133104	29409261302432	Mahmoud El0Sayed Attia	محمود السيد عطيه عزازى	Sharqya	Male	1 January 2023
1153989355	4561	12954	LAAS	MAXAB	133119	29309051803418	Mohamed Fathy Mohamed Ahmed Abo0Nadar	محمد فتحى محمد احمد	Alexandria	Male	21 January 2023
1148728619	4680	13446	LAAS	MAXAB	133310	29004072501432	Khaled Hassen Abdel Razak Ali	خالد حسن عبدالرازق على	Assiut	Male	21 January 2023
1100137028	4988	14238	LAAS	MAXAB	133316	29603052603671	Adel Abdullah Abdel Azim Ahmed	عادل عبدالله عبدالعظيم احمد	Sohag	Male	21 January 2023
1287306772	4942	14064	LAAS	MAXAB	133317	29201211801438	Ahmed Elsaeed Ahmed Sayed Ahmed	احمد السعيد احمد سيد احمد	Alexandria	Male	21 January 2023
1201954465	5328	15797	LAAS	MAXAB	133312	29401091600416	Osama  Ahmed Al0Attar	اسامه احمد الفيومى العطار	El Mahala	Male	28 January 2023
1153490593	4643	13285	LAAS	MAXAB	133487	29805162200876	Mohamed Ramadan Abd El Aziz	محمد رمضان عبدالعزيز محمد	Bani Sweif	Male	21 February 2023
1202597956	5207	15220	LAAS	MAXAB	133492	29609010202233	Mohamed Morsy Gaber	محمد مرسى جابر مرسى	Alexandria	Male	19 March 2023
1007419334	5206	15218	LAAS	MAXAB	134016	29402011204996	Mohamed Ahmed Mohamed Abdelrhman	محمد احمد عبدالشافى محمد عبدالرحمن	Mansoura	Male	22 June 2023
1272830563	18023	18023	LAAS	MAXAB	134639	29808020202137	Moustafa Mahmoud Bastawy Abdelgalil	مصطفى محمود بسطاوى عبدالجليل	Alexandria	Male	20 August 2023
1110390918	5186	15123	LAAS	MAXAB	134643	29710262200091	Ayman Ahmed  Salah Gad	ايمن احمد صلاح جاد	Bani Sweif	Male	21 August 2023
1002934732	5329	15801	LAAS	MAXAB	134748	29001081602617	Suleiman Mansour Ali	سليمان منصور محمد على	El Mahala	Male	16 October 2023
1276707398	4678	13437	LAAS	MAXAB	134013	29510221201776	Fahmy Mosaad Ahmed	فهمى مسعد احمد محمد يونس	Mansoura	Male	16 December 2023
1558393591	18112	18112	LAAS	MAXAB	134919	30209021201155	Ahmed Hamdy Yousef	احمد حمدى يوسف مصطفى يوسف	Mansoura	Male	16 December 2023
1021626983	5884	17620	LAAS	MAXAB	135257	30301221203318	Ahmed Salah El Sayed	احمد صلاح السيد شعبان المنصورى	Mansoura	Male	16 December 2023
1009122448	5727	17033	LAAS	MAXAB	134991	29112268800079	Ahmed Mostafa Mohamed Bayomy	احمد مصطفى محمدبيومى يونس رمضان	Menia	Male	31 December 2023
1026434512	18217	18217	LAAS	MAXAB	135184	28802121300553	Mohamed reda mahdi Ibrahim	محمد رضا مهدى ابراهيم	Sharqya	Male	3 February 2024
1062639548	27554	27554	LAAS	MAXAB	135186	29508171301176	Mohamed ahmed mansour mohamed	محمد احمد منصور محمد	Sharqya	Male	3 February 2024
1229398682	28150	28150	LAAS	MAXAB	135185	29404171600718	Ahmed Elsaid Mustafa Abo Elshbaik	احمد السعيد مصطفى ابوالشبايك	El Mahala	Male	13 February 2024
1002503637	5331	15809	LAAS	MAXAB	135255	29104182500258	Islam Abdel Moneim Gomaa Metwally	اسلام عبدالمنعم جمعه متولى	Assiut	Male	21 February 2024
1153428835	28332	28332	LAAS	MAXAB	135272	29404111801315	Mohamed Kamel Hemeda Mohamed Mousa	محمد كامل حميده محمد موسى	Alexandria	Male	6 March 2024
1018969778	28336	28336	LAAS	MAXAB	135408	30201291201415	Amr Hisham Mustafa Abdullah	عمرو هشام مصطفى عبدالله	Mansoura	Male	22 May 2024
1065886612	4411	12360	LAAS	MAXAB	132182	29908241700551	Ahmed Eldesoky Marzouk	احمد الدسوقى مرزوق عبدالعال	Tanta	Male	26 May 2024
1004989322	18122	18122	LAAS	MAXAB	135487	29501012615033	Omar Mostafa Mohamed	عمر مصطفى محمد مصطفى	Sohag	Male	21 June 2024
1274873412	28781	28781	LAAS	MAXAB	135686	29804051802498	Yousef Shaban Fathala Arafa	يوسف شعبان فتح الله عبدالحليم	Alexandria	Male	30 June 2024
1023079956	28213	28213	LAAS	MAXAB	135489	29407022503237	Mohamed Khalifa Mohamed Othman	محمد خليفه محمد عصمان	Assiut	Male	4 July 2024
1026298268	28281	28281	LAAS	MAXAB	135488	30011012604072	Mohamed Hamdi Zakaria Khalaf	محمد حمدى زكريا خلف	Sohag	Male	6 July 2024
1204790618	28925	28925	LAAS	MAXAB	135496	29801011842595	Mohamed Musa Mostafa Sherif	محمد موسى مصطفى شريف	Alexandria	Male	13 July 2024
1275408704	28586	28586	LAAS	MAXAB	135690	29002181301815	Mahmoud Elsayed Abdelsalam Mohammed	محمود السيد عبد السلام محمد	Sharqya	Male	23 July 2024
1157506984	18150	18150	LAAS	MAXAB	135517	29303062400511	Mohamed Araby Ahmed Siddiq	محمد عربى احمد صديق	Menia	Male	24 July 2024
1092712334	18120	18120	LAAS	MAXAB	135518	30105012404736	Galal Mohamed Shaaban Ahmed	جلال محمد شعبان احمد	Menia	Male	24 July 2024
1018005511	29155	29155	LAAS	MAXAB	135674	29504021600978	Mohamed Ahmed Mohamed Metwally	محمد احمد محمد متولى عبدالله	Tanta	Male	3 August 2024
1275209063	28754	28754	LAAS	MAXAB	135675	28309080200877	Mahmoud Mohamed Ibrahim Ahmed	محمود محمد ابراهيم احمد	Alexandria	Male	24 August 2024
1142206164	29170	29170	LAAS	MAXAB	135689	30105222201099	Amr Ahmed  Abdeltawaab Hassen	عمرو احمد عبدالتواب حسن	Bani Sweif	Male	1 September 2024
1208456741	29429	29429	LAAS	MAXAB	135717	30206241800212	Mohamed Ibrahim Goma Ibrahim	محمد ابراهيم جمعه ابراهيم	Alexandria	Male	16 September 2024
1205916658	28794	28794	LAAS	MAXAB	135688	29210011604696	Mohamed Elsayed Tawfik Glasa	محمد السيد توفيق جلاسه	El Mahala	Male	21 September 2024
1095746469	28706	28706	LAAS	MAXAB	135715	30007292500814	Osman Ibrahim Mohamed Osman	عثمان ابراهيم محمد عثمان	Assiut	Male	23 October 2024
1022015510	33349	33349	LAAS	LAAS	135795	30007251203856	Mahmoud Hassan Fattouh Ali	محمود حسن فتوح علي	Mansoura	Male	21 November 2024
1016377076	33291	33291	LAAS	LAAS	135763	29707262400137	Sherif Mohamed Hassen Hafez	شريف محمد حسن حافظ	Menia	Male	30 November 2024
201280721497	33556	33556	LAAS	LAAS	135804	29106281800371	Mohamed Ahmed Abdelfatah Mohamed	محمد أحمد عبد الفتاح محمد	Alexandria	Male	7 December 2024
1127292431	28219	28219	LAAS	LAAS	135826	29708202503138	Ahmed Hilal Siddiq Mohamed	أحمد هلال صديق محمد	Assiut	Male	12 January 2025
1022571264	33761	33761	LAAS	LAAS	135831	29901011623839	Abdallah Mohamed Elsaid Ahmed Elmalah	عبد الله محمد السيد أحمد الملاح	El Mahala	Male	21 January 2025
1224582249	5870	17567	Outsource	AZZ	28702241303454	28702241303454	Mohamed Elhossieny Mahmoud Mohamed	محمد الحسيني محمود محمد	Alexandria	Male	18 July 2023
1278939085	28551	28551	Outsource	AZZ	29407111801152	29407111801152	Mostafa Mahmoued Mohamed Elgharbawy	مصطفى محمود محمد الغرباوي	Alexandria	Male	28 May 2024
1124870799	33226	33226	Outsource	AZZ	29705112402058	29705112402058	Hossam Mokhtar Menaza Ali	حسام مختار منازة علي	Menia	Male	29 July 2024
1022625809	26804	26804	Outsource	AZZ	30108041603135	30108041603135	Reda Abdelfatah Mahmoud El syad	رضا عبد الفتاح محمود السيد	Tanta	Male	22 August 2024
1122364131	33221	33221	Outsource	AZZ	30101271801373	30101271801373	Hemdan Metwally Abdelrehem Ahmed	حمدان متولي عبد الرحيم أحمد	Alexandria	Male	29 September 2024
1222727582	33442	33442	Outsource	AZZ	30103131800671	30103131800671	Ahmed Saber Shaban Abdelrahman	أحمد صابر شعبان عبد الرحمن	Alexandria	Male	6 November 2024
1222946319	28746	28746	Outsource	AZZ	29809211400814	29809211400814	Ahmed Fathy Abdelatif Hamouda	أحمد فتحي عبد اللطيف حمودة	Alexandria	Male	21 November 2024
1065938273	33284	33284	Outsource	AZZ	30012021801014	30012021801014	Adel Khaled Kamal Badr Deyab	عادل خالد كمال بدر دياب	Alexandria	Male	4 January 2025
1122372743	33897	33897	Outsource	AZZ	30208041803198	30208041803198	Mostafa Ahmed Gomaa Eisa Ibrahim	مصطفى أحمد جمعة عيسى إبراهيم	Alexandria	Male	14 January 2025
1211431655	33954	33954	Outsource	AZZ	29903102203134	29903102203134	Ahmed Ali Ahmed Ibrahem	أحمد علي أحمد إبراهيم	Bani Sweif	Male	21 January 2025
1123085748	33686	33686	LAAS	MAXAB	29802212603137	29802212603137	" Mahmoud AlSayyid Ezz AlArab	"	محمود السيد عز العرب  عبد المجيد	Sohag	Male	21 January 2025
1097557613	33687	33687	LAAS	MAXAB	29611032604739	29611032604739	" Ahmed Hassan Ahmed Ahmed	"	" أحمد حسن أحمد أحمد	"	Sohag	Male	21 January 2025
1029942751	28557	28557	Outsource	AZZ	30411292400455	30411292400455	Mohamed Essam Qadry Ahmed	محمد عصام قدري أحمد	Menia	Male	21 January 2025
1274596923	34061	34061	Outsource	AZZ	29312251600237	29312251600237	"Ahmed Ali Ibrahim Osman	"	"أحمد علي إبراهيم عثمان	"	Tanta	Male	15 February 2025
1289468125	34194	34194	Outsource	AZZ	29508021600817	29508021600817	Muhammed El Sayed Muhammed Hassan El Sabbagh	محمد السيد محمد حسن الصباغ	Tanta	Male	8 March 2025
1126160321	33849	33849	Outsource	AZZ	29807181600152	29807181600152	Mohamed Fathy Abdelkhader Abukhatwa	محمد فتحي عبد القادر ابوخطوة	Tanta	Male	29 March 2025
201289076864	26846	26846	Outsource	AZZ	28902160200358	28902160200358	"Mahmoud Saleh Ibrahim Attia	"	محمود صالح إبراهيم عطية	Alexandria	Male	5 April 2025
1145894302	34374	34374	Outsource	AZZ	29512182501379	29512182501379	Kamal Mohamed Kamal Mahmoud	كمال محمد كمال محمود	Assiut	Male	21 April 2025
201270883622	34290	34290	Outsource	AZZ	30203311800534	30203311800534	" Abdelmoged Saber Abdelmoged Khater	"	" عبد المجيد صابر عبد المجيد خاطر	"	Alexandria	Male	23 April 2025
1129528461	34523	34523	Outsource	AZZ	30110152200212	30110152200212	"Eslam Ramdann Meawd Tamam	"	إسلام رمضان ميعاد تمام	Bani Sweif	Male	6 May 2025
1119168516	34162	34162	Outsource	AZZ	29410112601239	29410112601239	"Mohamed Mukhtar Mohamed Abdullah	"	"محمد مختار محمد عبدالله	"	Sohag	Male	28 April 2025
1060713016	34548	34548	Outsource	AZZ	29503132201413	29503132201413	Islam ALI Abd El Hameed Farag	إسلام علي عبد الحميد فرج	Bani Sweif	Male	26 May 2025
1018151633	36839	36839	Outsource	AZZ	29201012207136	29201012207136	Abdelrahman Abdelaal Ahmed Abdellatif	عبد الرحمن عبد العال أحمد عبد اللطيف	Bani Sweif	Male	26 May 2025
1090057242	36797	36797	Outsource	AZZ	28608012201072	28608012201072	Ahmed Abo Taleb Mahmoud Mohamed	أحمد أبو طالب محمود محمد	Bani Sweif	Male	26 May 2025
1013739556	36808	36808	Outsource	AZZ	29011282400031	29011282400031	"Mohamed Alaa Eldin Abdelkerim Sayed	"	"محمد علاء الدين عبد الكريم سيد	"	Menia	Male	27 May 2025
1128179646	36849	36849	Outsource	AZZ	30201202404677	30201202404677	"Ahmed Khaled Mahmoud Mohamed	"	أحمد خالد محمود محمد	Menia	Male	27 May 2025
1277570693	36826	36826	Outsource	AZZ	30008192501771	30008192501771	Mostafa Mahmoud Sayed Saleh        	مصطفى محمود سيد صالح	Assiut	Male	12 June 2025
1201162169	28805	28805	Outsource	AZZ	28701061200499	28701061200499	Khaled Hamza Abdel Wahid Bondok	خالد حمزة عبد الواحد بندق	Mansoura	Male	21 August 2025
1157462573	33848	33848	Outsource	AZZ	30311011207014	30311011207014	Atallah Gaber Atallah Saleh	عطا الله جابر عطا الله صالح	Mansoura	Male	21 August 2025
1003652064	34332	34332	Outsource	AZZ	29904071201371	29904071201371	Mohamed Ashraf Mohamed Awad	محمد أشرف محمد عوض	Mansoura	Male	21 August 2025
1093667853	37203	37193	LAAS	MAXAB	29711262401319	29711262401319	Hassan Mohamed Hassan Mohamed        	حسن محمد حسن محمد        	Menia	Male	21 December 2025
1286317538	37258	37254	Outsource	AZZ	30008161600356	30008161600356	" Youssef Belal Abdelaziz Elkaradawy	"	" يوسف بلال عبد العزيز القرضاوي	"	El Mahala	Male	21 September 2025
1009234447	34574	34574	Outsource	AZZ	29705092200216	29705092200216	"Ahmed Shaaban Abd El Azeem Shoueme Mohamed	"	"أحمد شعبان عبد العظيم شومي محمد	"	Bani Sweif	Male	29 September 2025
1115280583	36813	36813	Outsource	AZZ	29701131302018	29701131302018	Abdul Aziz Sami Abdul Aziz Salem        	عبد العزيز سامي عبد العزيز سالم        	Sharqya	Male	10 December 2025
201204710923	28905	28905	Outsource	AZZ	29902011823958	29902011823958	Shehata Attia Mohamed Ibrahim	شحاتة عطية محمد إبراهيم	Alexandria	Male	10 December 2025
1004331059	37250	37,242	Outsource	AZZ	30307031201937	30307031201937	Hassan Mohamed El Behie	حسن محمد البهي	Mansoura	Male	21 December 2025
1203050793	37497	37,577	Outsource	AZZ	29905101601171	29905101601171	Ahmed Mosaad Abdelkader	أحمد مساعد عبد القادر	El Mahala	Male	21 December 2025
1225110430	37542	37,630	Outsource	AZZ	29109121600499	29109121600499	Ahmed Ibrahim Almandouh	أحمد إبراهيم المندوح	El Mahala	Male	21 December 2025
1204159622	37310	37,316	Outsource	AZZ	30211161601352	30211161601352	Mohamed Hany Ibrahim Elrabeb	محمد هاني إبراهيم الربيب	El Mahala	Male	21 December 2025
1009261975	34495	34495	LAAS	MAXAB	29708161600336	29708161600336	Moamen Muhammed Hamdi El Shal	مؤمن محمد حمدي الشال	Tanta	Male	27 December 2025
1220426800	966	2,423	LAAS	MAXAB	29412051600032	29412051600032	Nour El Din Tarek Mohammed Hassan Mohamed        	نور الدين طارق محمد حسن محمد        	Tanta	Male	29 December 2025
1069193870	37295	37,300	Outsource	AZZ	30402061700493	30402061700493	Ahmed Foad Basyouni El Shanawany	أحمد فؤاد بسيوني الشنواني	Tanta	Male	29 December 2025
1012979130	37498	37,578	LAAS	MAXAB	29805251600411	29805251600411	Amir Ahmed Mohamed Metwally	أمير أحمد محمد متولي	Tanta	Male	29 December 2025
1032485544	28648	28,648	LAAS	MAXAB	28901011200152	28901011200152	Khaled Ragab Mohamed Abo ElWafa	خالد رجب محمد أبو الوفا	Mansoura	Male	27 December 2025
1145094062	37552	37,641	Outsource	AZZ	29901212401559	29901212401559	Eslam Adel Marzouk Abdel hamid	اسلام عادل مرزوق عبد الحميد	Menya Samalot	Male	29 December 2025
1202941651	37561	37,653	Outsource	AZZ	30011212200596	30011212200596	Mahmoud Mohamed Taha Abd El Gawad	محمود محمد طه عبد الجواد	Bani Sweif	Male	29 December 2025
1273077839	37643	37,751	Outsource	AZZ	30301312400051	30301312400051	Yussef Magdy Samuel Maqar	يوسف مجدي صموئيل مقر	Menya Samalot	Male	21 January 2026
201273286778	29420	29,420	Outsource	AZZ	30411010201556	30411010201556	Mohamed Ragab Abdel Aziz Abdel Ailim	محمد رجب عبد العزيز عبد العليم	Alexandria	Male	24 January 2026
1062724469	37583	37,680	Outsource	AZZ	29902101204777	29902101204777	Mohamed Saleh Abe El Wahab	محمد صالح أبي الوهاب	Mansoura	Male	21 February 2026
1152024788	2662	6,074	Outsource	AZZ	29001081600835	29001081600835	Mohamed Hamed Al Akraa	محمد حامد الأكرة	El Mahala	Male	21 February 2026
1120099639	37698	37,819	Outsource	AZZ	29404201302814	29404201302814	Ahmed Adil Taha Hamouda	أحمد عادل طه حمودة	Sharqya	Male	22 February 2026
1022652188	37854	38,043	Outsource	AZZ	29308211300756	29308211300756	Ahmed Salah Fawzi Abdelhamed Mohamed        	أحمد صلاح فوزي عبد الحميد محمد        	Sharqya	Male	22 February 2026
1113135652	37571	37,664	Outsource	AZZ	30007082402992	30007082402992	Mostafa Mohamed Moteia Ahmed	مصطفى محمد موتي أحمد	Menya Samalot	Male	22 February 2026
1060720786	37828	37,998	Outsource	AZZ	30405112402696	30405112402696	Abd Allah Lotfy Mohamed Abdel Aziz	عبد الله لطفي محمد عبد العزيز	Menya Samalot	Male	22 February 2026
1229824766	37850	38,039	Outsource	AZZ	29403011602297	29403011602297	Mohamed Atef Elsayed Dawood	محمد عاطف السيد داود	El Mahala	Male	21 February 2026
201055758562	37860	38,050	Outsource	AZZ	30107111800654	30107111800654	Islam Said Gomaa Elsayed Gomaa	اسلام سعيد جمعة السيد جمعة	Alexandria	Male	28 February 2026
1030458681	33836	33,836	Outsource	AZZ	30511011314812	30511011314812	Ahmed Mohamed AtiyaTolba	أحمد محمد عطية طلبة	Sharqya	Male	2 March 2026
1208289475	37877	38,069	Outsource	AZZ	30106011214778	30106011214778	Mohamed Mostafa AbdelAzim Ibrahim	محمد مصطفى عبد العظيم ابراهيم	Mansoura	Male	1 March 2026
1143395457	3629	9,078	Outsource	AZZ	29901072200639	29901072200639	 Ahmed Ibrahem Ahmed Metwaly	أحمد إبراهيم أحمد متولي	Bani Sweif	Male	5 March 2026
1107379946	37889	38,082	Outsource	AZZ	30102242200278	30102242200278	Taha OsamaTaha Bakr	طه أسامة طه بكر	Bani Sweif	Male	5 March 2026
1096328960	37878	38,070	Outsource	AZZ	29909212602792	29909212602792	Hamza Ahmed Mohamed Ahmed	حمزة أحمد محمد أحمد	Sohag	Male	5 March 2026
1152159226	37906	38,106	Outsource	AZZ	30208251201393	30208251201393	Abdelaziz Magdy Abdelhady Suleiman	عبد العزيز مجدي عبد الهادي سليمان	Mansoura	Male	5 March 2026
1030132601	37912	38,113	Outsource	AZZ	30012011317777	30012011317777	Mohamed Samir Mohamed Ali Farag	محمد سمير محمد علي فرج	Sharqya	Male	7 March 2026
1223832874	37886	38,077	Outsource	AZZ	30207291300152	30207291300152	Marwan Elsayed Arafa Abdelkhalek	مروان السيد عرفة عبد الخالق	Sharqya	Male	7 March 2026
1153127086	37924	38,127	Outsource	AZZ	30406012408537	30406012408537	Ahmed Mohamed Saber Mohamed	أحمد محمد صابر محمد	Menya Samalot	Male	8 March 2026
1153073582	37926	38,130	Outsource	AZZ	29905272401472	29905272401472	Sayed Rashad Ahmed Ali	سيد رشاد أحمد علي	Menya Samalot	Male	8 March 2026
1116757611	37927	38,131	Outsource	AZZ	30710152404597	30710152404597	Eslam Rashad Ahmed Ali	إسلام رشاد أحمد علي	Menya Samalot	Male	8 March 2026
1117738983	37890	38,083	Outsource	AZZ	30504068800113	30504068800113	Ahmed Abdel Sattar Ahmed Abdel Halim 	أحمد عبد الستار أحمد عبد الحليم 	Assiut	Male	9 March 2026
1116771654	37614	37,719	Outsource	AZZ	30110011617012	30110011617012	Khaled Shawky Said Ahmed Mansour	خالد شوقي سعيد أحمد منصور	Tanta	Male	7 March 2026
1092548074	37842	38,031	Outsource	AZZ	30110281600634	30110281600634	Hazem Foad Hamdi Fathallah Fouda	حازم فؤاد حمدي فتح الله فودة	Tanta	Male	7 March 2026
1112366719	37684	37,806	Outsource	AZZ	29703181600136	29703181600136	Mahmoud El Sayed Khalil Abdullah	محمود السيد خليل عبد الله	Tanta	Male	7 March 2026
1289649466	37735	38,095	Outsource	AZZ	29004171600051	29004171600051	Kamel Ibrahim Kamel Ibrahim	كامل إبراهيم كامل إبراهيم	Tanta	Male	7 March 2026
1029303902	4534	12,865	Outsource	AZZ	29709223300195	29709223300195	Abdulhakim Amin Muhammed Amin	عبد الحكيم أمين محمد أمين	Tanta	Male	7 March 2026
1112482009	37946	38,151	Outsource	AZZ	29901012420133	29901012420133	Ahmed Mahmoud Ahmed Mahmoud	أحمد محمود أحمد محمود	Menya Samalot	Male	10 March 2026
1014304244	37953	38,159	Outsource	AZZ	30103082402371	30103082402371	Mohamed Medhat Saber Nemr	محمد مدحت صابر نمر	Menya Samalot	Male	10 March 2026
1019520817	37954	38,160	Outsource	AZZ	30104082403277	30104082403277	Mohamed Abdel Kader Ahmed Abdel Halim	محمد عبد القادر أحمد عبد الحليم	Menya Samalot	Male	10 March 2026
1099665155	37907	38,107	Outsource	AZZ	29806092500199	29806092500199	 Saif Al Din Hisham Kamal	سيف الدين هشام كمال	Assiut	Male	10 March 2026
1070158940	37951	38,157	Outsource	AZZ	30405261201377	30405261201377	Mohamed Fouad Abdel Latef Hassanin	محمد فؤاد عبد اللطيف حسنين	Mansoura	Male	10 March 2026
1013443040	37952	38,158	Outsource	AZZ	29510011236437	29510011236437	Nader Mohamed Mohamed Mowafy	نادر محمد محمد موافي	Mansoura	Male	10 March 2026
1012347096	37949	38,154	Outsource	AZZ	30301291200634	30301291200634	Ebrahim Mohamed ElMorssy	إبراهيم محمد المرسي	Mansoura	Male	9 March 2026
1010661080	37910	38,111	Outsource	AZZ	29811182601354	29811182601354	Khaled Ali Mohamed Ahmed	خالد علي محمد أحمد	Sohag	Male	9 March 2026
1120908191	28267	28,267	Outsource	AZZ	30102012508338	30102012508338	Ahmed Mohamed Ahmed Abdel Halim	أحمد محمد أحمد عبد الحليم	Assiut	Male	7 March 2026
201277658871	37884	38,075	Outsource	AZZ	30304131802815	30304131802815	Mohamed Sherif Saad Abdullah	محمد شريف سعد عبد الله	Alexandria	Male	16 March 2026
201092598600	37928	38,132	Outsource	AZZ	30407011800936	30407011800936	Ahmed Farhat Awad Abdellateif Motter	أحمد فرحات عوض عبد اللطيف موتر	Alexandria	Male	16 March 2026
1068526236	37532	37,616	Outsource	AZZ	29906211300556	29906211300556	 Mohamed Nabil Ahmed Hassan Elawadi	 محمد نبيل أحمد حسن العوضي	Sharqya	Male	23 March 2026
1019662567	37226	37,218	Outsource	AZZ	29909301602372	29909301602372	 Mahmoud Hamdy Eldeeb	محمود حمدي الديب	El Mahala	Male	23 March 2026
1003390394	37266	37,263	Outsource	AZZ	29307261600835	29307261600835	 Ibrahim Abdul Aziz Ali AlDaouri	 ابراهيم عبد العزيز علي الدوري	El Mahala	Male	23 March 2026
201211353722	28382	28,382	Outsource	AZZ	30208191802297	30208191802297	Hossam Ahmed Saied Saad Moustafa	حسام أحمد سعيد سعد مصطفى	Alexandria	Male	26 March 2026
1064189134	37989	38,197	Outsource	AZZ	30401142404019	30401142404019	Mahmoud Younes Mohamed Younes	محمود يونس محمد يونس	Menya Samalot	Male	23 March 2026
1102377783	37973	38,180	Outsource	AZZ	30402192401157	30402192401157	Omar Mohamed Madi Mohamed	عمر محمد مادي محمد	Menya Samalot	Male	23 March 2026
1015701159	37959	38,165	Outsource	AZZ	30309092503858	30309092503858	Mohamed Mahmoud Mohamed Sedek	محمد محمود محمد صادق	Assiut	Male	23 March 2026
1093265467	37934	38,138	Outsource	AZZ	30004082500197	30004082500197	Mostafa Galal Ahmed Thabet	مصطفى جلال أحمد ثابت	Assiut	Male	23 March 2026
1006575523	37997	38,212	Outsource	AZZ	29801011230128	29801011230128	Mamdouh Aboudah Mamdouh Ibrahim	ممدوح عبوده ممدوح ابراهيم	Mansoura	Male	23 March 2026
1027389011	38013	38,227	Outsource	AZZ	29709021200875	29709021200875	Abd El Aziz Atef El Sayed Ahmed	عبد العزيز عاطف السيد أحمد	Mansoura	Male	26 March 2026
1066152622	38014	38,228	Outsource	AZZ	29601011234812	29601011234812	Emad Fathy Elsayed Abdo	عماد فتحي السيد عبدو	Mansoura	Male	26 March 2026
1014648830	37984	38,192	Outsource	AZZ	30304122500156	30304122500156	Gamal Ahmed Abdelal Hamed	جمال أحمد عبد الحميد	Assiut	Male	28 March 2026
1031550007	37958	38,164	Outsource	AZZ	29307071601053	29307071601053	Emad Abdulalim Ahmed El Meseiry	عماد عبد العليم أحمد المسيري	Tanta	Male	30 March 2026
1023245086	37941	38,146	Outsource	AZZ	29911011604376	29911011604376	Ahmed Mahrous Hassan El Marabie	أحمد محروس حسن المرعبي	Tanta	Male	30 March 2026
1030446201	37963	38,169	Outsource	AZZ	30212081802272	30212081802272	Tawfik Ibrahim Tawfik Ali Alareny	توفيق ابراهيم توفيق علي العريني	Alexandria	Male	1 April 2026
1010187386	38020	38,236	Outsource	AZZ	30111211800918	30111211800918	Ali Reda Mohamed Ibrahim	علي رضا محمد إبراهيم	Alexandria	Male	1 April 2026
1015565111	38239	38239	Outsource	AZZ	29204221200652	29204221200652	Mohamed Hamed Abd El Aziz Eied	محمد حامد عبد العزيز عيد	Mansoura	Male	29/3/2026
1064957377	38277	38277	Outsource	AZZ	30006231201613	30006231201613	Eslam Mohamed salem Ahmed	إسلام محمد سالم أحمد	Mansoura	Male	4 April 2026
1289380696	38295	38,295	Outsource	AZZ	30308041202415	30308041202415	Mohammed Attia Awadallah Attia	محمد عطية عوض الله عطية	Mansoura	Male	5 April 2026
1145626606	37975	38,182	Outsource	AZZ	30103151308676	30103151308676	 Mostafa Mohsen Elsayed Ahmed Ali	 مصطفى محسن السيد أحمد علي	Sharqya	Male	6 April 2026
1094271101	38067	38,298	Outsource	AZZ	30509271305359	30509271305359	Mohamed Ayman Muhammad Amin Bandari	محمد أيمن محمد أمين البنداري	Sharqya	Male	6 April 2026
1064550107	37919	38,120	Outsource	AZZ	30311071301419	30311071301419	Emad Hassan Ahmed Hassan	عماد حسن أحمد حسن	Sharqya	Male	6 April 2026
1200024965	37983	38,191	Outsource	AZZ	30601241800812	30601241800812	 Zeyad Sobhy Abdelaziz Rezk Hamed	 زياد صبحي عبد العزيز رزق حامد	Alexandria	Male	11 April 2026
1090426368	37992	38,203	Outsource	AZZ	29308011609477	29308011609477	Muhammed Magdy El Basyouni Abu El Kheir	محمد مجدي البسيوني ابو الخير	Tanta	Male	16 April 2026
1060668390	38116	38,377	Outsource	AZZ	30104041601692	30104041601692	 Mustafa Abdulalim Ahmed El Meseiry	 مصطفى عبد العليم أحمد المسيري	Tanta	Male	16 April 2026
1026688679	38084	38,318	Outsource	AZZ	30011221201074	30011221201074	Elsayed Magdy Elsayed Salama	السيد مجدي السيد سلامة	Mansoura	Male	8 April 2026
1124030126	38079	38,313	Outsource	AZZ	30101032600277	30101032600277	Islam Mohamed Helmy Abdelhamid	اسلام محمد حلمي عبد الحميد	Sohag	Male	6 April 2026`;

const lines = dataString.trim().split('\\n').slice(1);
const parsedRows = lines.map(line => {
  const [
    mobile_number, sys_code, partner_id, insur_comp, structure_company,
    maxer_id, national_id, name_en, name_ar, site, gender, hiring_date
  ] = line.split('\\t').map(c => c.trim().replace(/^"|"$/g, ''));
  return {
    mobile_number,
    sys_code,
    partner_id,
    insur_comp,
    structure_company,
    maxer_id,
    national_id,
    name_en,
    name_ar,
    site,
    gender,
    hiring_date
  };
});

async function run() {
  console.log('Total rows:', parsedRows.length);
  // Optional: you can first delete all existing to avoid duplicates, or just upsert based on national_id?
  // Let's delete existing first since it's a seed
  await supabase.from('oms_employees').delete().neq('national_id', '___never___');
  
  const BATCH = 50;
  for (let i = 0; i < parsedRows.length; i += BATCH) {
    const chunk = parsedRows.slice(i, i + BATCH);
    const { error } = await supabase.from('oms_employees').upsert(chunk, { onConflict: 'national_id' });
    if (error) {
      console.error('Error inserting chunk:', error);
    } else {
      console.log('Inserted chunk', i, 'to', i + chunk.length);
    }
  }
  console.log('Done!');
}
run();
