# WFL Medal Count

Windows app for the Whyalla Football League medal count.

Grades: **U/12's**, **U/15's**, **U/18's**, **Reserves**, and **League**.

## How it works

1. **Before the night** (internet needed once): click **Sync from website**. That pulls fixtures, team sheets, club logos, and player photos from whyallafootball.com.au / MatchDay Centre and saves them on this PC.
2. Still before the night: pick a grade tab (**U/12's**, **U/15's**, **U/18's**, **Reserves**, or **League**) and pick **3, 2, 1** from each team sheet.
3. Add sponsor images on the Sponsors tab.
4. **On the night** (works offline): open **Audience display** on the second screen and step through the presentation. Votes, photos, logos, and sponsors are already on the PC.

## Run

```
npm install
npm run dist:win
```

Then use `MedalCount.run.bat`, or the installer in `release`.
