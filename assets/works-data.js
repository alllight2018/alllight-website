/* ============================================================
   全国実績マップ 用データ（index.html / works.html 共通）
   - 公共工事の落札額は公開情報。民間案件の金額は掲載しない。
   - 発注者担当者名・利益等の非公開情報は含めない。
   ============================================================ */
window.ALLLIGHT_MAP_DATA = [
  // ▼ 兵庫県（本社エリア）
  { pref:"兵庫県", name:"神戸大学 自然科学総合研究棟 火災報知設備改修工事", client:"国立大学法人 神戸大学", type:"工事", status:"施工実績", amount:"約600万円", photo:"/assets/photos/sekou-kanri.jpg", desc:"国立大学の防災（自動火災報知）設備。地元・神戸での確かな実績。" },
  { pref:"兵庫県", name:"市街地各所 直流無停電電源設備更新工事", client:"神戸市", type:"工事", status:"施工実績", amount:"約7,370万円", photo:"/assets/photos/genba.jpg" },
  { pref:"兵庫県", name:"市立岩園小学校 受変電設備更新工事", client:"芦屋市", type:"工事", status:"施工実績", amount:"約970万円", photo:"/assets/photos/building-night.jpg" },
  { pref:"兵庫県", name:"本庁舎北館・南館 自動火災報知設備更新工事", client:"芦屋市", type:"工事", status:"受注・施工中", photo:"/assets/photos/sekou-kanri.jpg" },
  { pref:"兵庫県", name:"ポートアイランド地区他 ヤード照明LED化工事", client:"神戸市", type:"工事", status:"受注・施工中", photo:"/assets/photos/building-night.jpg" },
  { pref:"兵庫県", name:"大阪拘置所尼崎拘置支所 庁舎棟 照明設備LED化改修工事", client:"法務省 大阪拘置所", type:"工事", status:"受注・施工中", photo:"/assets/photos/building-night.jpg" },
  { pref:"兵庫県", name:"神戸駅南駐車場 泡消火設備整備業務", client:"神戸市", type:"役務", status:"受注・施工中", photo:"/assets/photos/sekou-kanri.jpg" },
  { pref:"兵庫県", name:"東クリーンセンター 煙突（高さ100m）航空障害灯 更新工事", client:"神戸市", type:"工事", status:"施工実績", photo:"/assets/photos/work-koushougai.jpg", desc:"高さ100mの煙突頂部で航空障害灯を更新。高所・特殊環境での電気工事にも対応します。" },

  // ▼ 石川県（防衛省・航空自衛隊）
  { pref:"石川県", name:"小松基地 高圧ケーブル等更新工事（CET38 約3km）", client:"航空自衛隊（防衛省）", type:"工事", status:"施工実績", amount:"約3,670万円", photo:"/assets/photos/work-cable-komatsu.jpg", desc:"防衛省・航空自衛隊小松基地。高圧ケーブル(CET38)を約3km更新。高圧工事を得意としています。" },

  // ▼ 東京都
  { pref:"東京都", name:"高圧受変電設備更新工事（八王子年金事務所）", client:"日本年金機構", type:"工事", status:"施工実績", amount:"約3,100万円", photo:"/assets/photos/work-cubicle.jpg", desc:"屋上へキュービクル（受変電設備）をクレーンで吊り込み設置。" },
  { pref:"東京都", name:"東京国際空港 消防東庁舎 受配電設備改良作業", client:"国土交通省 東京航空局", type:"役務", status:"施工実績", amount:"約240万円", photo:"/assets/photos/sekou-kanri.jpg", desc:"羽田空港（東京国際空港）の受配電設備。国交省案件。" },

  // ▼ 長野県（陸上自衛隊）
  { pref:"長野県", name:"2号建物他 電源改修工事", client:"陸上自衛隊（防衛省）", type:"工事", status:"施工実績", amount:"約86万円", photo:"/assets/photos/genba.jpg", desc:"信州・松本の陸上自衛隊施設。全国の防衛省案件に対応。" },

  // ▼ 神奈川県
  { pref:"神奈川県", name:"木月住宅ほか 共用部照明器具改修工事", client:"関東財務局", type:"工事", status:"受注・施工中", photo:"/assets/photos/building-night.jpg" },

  // ▼ 大阪府
  { pref:"大阪府", name:"大阪港安治川突堤南岸壁 電気設備工事", client:"第五管区海上保安本部", type:"工事", status:"受注・施工中", photo:"/assets/photos/genba.jpg" },

  // ▼ 三重県
  { pref:"三重県", name:"上野税務署 照明改修工事", client:"名古屋国税局", type:"工事", status:"受注・施工中", photo:"/assets/photos/building-night.jpg" },

  // ▼ 徳島県（新規受注）
  { pref:"徳島県", name:"国立大学 電気設備工事（徳島大学）", client:"国立大学法人 徳島大学", type:"工事", status:"受注（新規）", photo:"/assets/photos/genba.jpg", desc:"落札・受注。四国エリアの国立大学案件。全国の国立大学・省庁案件に対応します。" }
];

/* 全国実績サマリー（2025年 年間実績・経審など） */
window.ALLLIGHT_STATS = {
  keishin: 859,          // 経営事項審査 総合評定値（P点）
  bids: 332,             // 年間入札本数（2025年）
  wins: 26,              // 年間落札件数（2025年）
  prefectures: 8         // 施工実績エリア（都道府県数）
};
