"""Build the static share image. No runtime image generation or live values."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root = Path(__file__).resolve().parents[1]
image = Image.new('RGB', (1200,630), '#090e13')
draw = ImageDraw.Draw(image)
font_root = Path('/usr/share/fonts/truetype/dejavu')
def font(size, bold=False):
    return ImageFont.truetype(str(font_root / ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')), size)
draw.line([(64,73),(80,73),(87,53),(97,94),(107,73),(120,73),(128,61),(136,82),(145,73)], fill='#19c5ae',width=4)
draw.text((164,49),'Predpulse',font=font(27,True),fill='#eff6f5')
draw.text((64,155),'Prediction markets,',font=font(54,True),fill='#eff6f5')
draw.text((64,226),'in perspective.',font=font(54,True),fill='#eff6f5')
draw.text((66,310),'Movement. Policy. Attention.',font=font(25),fill='#9daeb7')
for i,label in enumerate(['Belief Shift','Policy balance','Market Attention']):
    x=64+i*367
    draw.rounded_rectangle((x,391,x+340,540),radius=18,fill='#111a22',outline='#25343e',width=2)
    draw.text((x+24,492),label,font=font(20),fill='#d7e6e9')
    if i==0:
        draw.line([(x+25,462),(x+75,452),(x+125,460),(x+177,426),(x+230,437),(x+309,411)],fill='#19c5ae',width=4)
    elif i==1:
        for j,(w,c) in enumerate([(40,'#657e91'),(146,'#7186c7'),(80,'#19c5ae')]):
            start=x+25+sum([40,146,80][:j])+j*6
            draw.rounded_rectangle((start,424,start+w,457),radius=5,fill=c)
    else:
        for box,c in [((x+25,413,x+149,471),'#19c5ae'),((x+155,413,x+227,443),'#7186c7'),((x+233,413,x+310,443),'#b58c61'),((x+155,449,x+310,471),'#3c657b')]:
            draw.rounded_rectangle(box,radius=4,fill=c)
draw.text((64,583),'predpulse.xyz',font=font(18),fill='#79909e')
image.save(root/'public/social-card.png',optimize=True)
