# Prompt

Let's initially forget about the import, I'll create a JSON with data to import later. I will tell you what I need built instead so you can documen this, capture requirements, and then we'll decide how to build this. Please document in CLAUDE.md and SPECIFICATION.md

As for sharepoint applications versus web hosted, I do not mind either way as long as I can put it somewhere shared and as long as it works on Mobile devices (!). I'd very much prefer not having to host and deploy a backend myself, and not dealing with authentication is better than having to.

Functionally the application does the following:

1. People will send e-mail to a shared office 365 mailbox that this user has access to. This software will find those e-mails in that mailbox that it did not previously process and will either append the mail to the "Request" that's currently open, or will create a new "Request" object. If the mail is a reply to an e-mail that was previously in the "Request" list and the requets is still open, then typically just add it to that request. Add the body of the e-mail to the conversation. If possible add alink to open the conversation in office 365.
2. Our logged in agent (a real person not an AI) will when they open the homescreen of the application have a list of open requests. Requests should be ordered in that list by date the last mail on that request arrived and all requests are shown, but the ones that we did not respond to (or marked as processed) are highlighted.
3. A Request can be in the states "New", "Pending", "Confirmed", "Redy for invoicing", "Closed" and "Deleted" and it should be obvious when seeing the list of requests in which state the request is. Also the list can be filtered on any of those states, and it should be very easy to transition a request to a new state.
4. When the agent opens the Request, they should be able to
    1. Respond in rich text which will send an e-mail response 
       User can add text from a "canned responses" list.
       When sending, a signature is applied automatically; this is already shown as read-only text below the text.
       In the future we'll use an AI prompt to generate a proper response.
    2. Easily withiout hassle check which times fit in the shared calendar. 
       Typically the sender will request a specific date or some dates and it would be good to be able to quickly jump to those dates to check availability. 
       It's important that all appointments that day including full day ones are visible.
    3. "Pencil in" an appointment at a certain time, which basically will create the appointments for the clinic (translates to demo in dutch) in the shared
       calendar. Will also create a 30-minute appointment for "Opbouwen demo" before the clinic and a 30 minute appointment after the clinic "Opruimen demo".
    4. Finalize a date, time and duration for the "demo"
    5. Enter details for the clinic  
        - Titel [when creating one copy name from the mail]
        - Name [when creating one copy name from the mail]
        - Organization
        - E-mail address [when creating one copy from the mail]
        - Phone number
        - IBAN
        - Type of "demo" ["Feest met barbecue", "Feest met koud buffet", "Bedrijfsdemo", "Privé demo", "Schoolklas", "Kinderfeestje", "Privéles", "Onbekend" ], 
        - Number of participants 
        - Number of helpers required [default: 2]
        - Borrel gewenst [ "geen", "vooraf", "achteraf", "beide", "patat met snack achteraf", "onbekend" ]
        - Wedstrijd gewenst [ "ja", "nee", "onbekend" ]
        - Prijsafspraak (free text)        
        - Note
    6. Assign helpers to help out during the demo, optionally includes a duration
    7. Permanently delete the Request
    8. Add public notes to the request
5. At the top level of the screen there is a hamburger menu with options:
   1. manually create a new request
   2. manage canned responses
   3. manage helpers
   4. manage types of clinic (demo)
   5. edit the mail signature.
   6. download excel [prompt for time period, creates excel with in it all clinics, all helpers, a table of clinic x helpers, a table of 
   7. help needed list
      1. creates as an image a table with all demos in the next 4 weeks [4 is an option that can be changed before the image is created] that do not have the requested amount of help yet; included details per row are date, time, duration, titel, type, number of participants
   8. upcoming demo list
      1. full list of all demo's planned for the next 4 weeks [4 is an option that can be changed before the image is created] as an image with per demo the same information as above, except for an additional first column that's a checkmark when the helpers are complete, and also clearly indicates when more help is needed.
   9. Invoice list
      1. Download an Excel document that contains all details of all invoiceable clinics (marked as ready to invoice.)
6. After a request is closed, mails are not automatically added to it anymore. These start a new Request.
7. Delete requires confirm.
8. It's possible to filter to only deleted entries
9. After a clinic was added the the outlook calendar, the system will keep thing synchronized between the calendar entry and this app's data (push, not pull)
10. The *Description* for the calendar entry will contain the type of demo and the number of participants, and the value of borrel gewenst 
11. The location of the calendar event contains the names of the helpers add *help wanted* if there are insufficiently many helpers (begeleiders).
12. The main calendar event is categorized as "Demo" [create if it does not exist]
13. The opbouwen en opruimen calendar events are categorized as "Gereserveerd (bevestigd)"
14. The software is in dutch, all documentation is in dutch (this should also have been in dutch)
15. Must work well on mobile and on desktop