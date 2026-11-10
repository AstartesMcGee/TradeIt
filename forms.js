function modal(html){$('#modalBody').innerHTML=html;$('#modal').showModal()}function legacyOffer(i){$('#modal').dataset.title='Trade proposal — tradeit';modal(`<h2>Make an offer.</h2><p>Propose a trade for ${esc(i.title)}.</p><p class="demo">This preview saves a trade draft on your device. It does not contact the owner.</p><form id="offerForm"><label>What would you like to offer?<input name="item" placeholder="e.g. My vintage record player" required maxlength="150"></label><label>A note about your trade<textarea name="message" placeholder="Tell them a little about your item…" required maxlength="2000"></textarea></label><button class="primary">Save trade draft ↗</button></form>`);$('#offerForm').onsubmit=e=>{e.preventDefault();let drafts=read('barter-drafts',[]);drafts.push({listing:i.id,...Object.fromEntries(new FormData(e.target)),created:new Date().toISOString()});localStorage.setItem('barter-drafts',JSON.stringify(drafts));$('#modal').close();toast('Trade draft saved in this browser.')}}
function listing(){$('#modal').dataset.title='Upload — tradeit';modal(`<span class="eyebrow">Make some room</span><h2>What are you trading?</h2><p>Add photos and details for the item you want to trade.</p><form id="listingForm"><label>Item name<input name="title" required maxlength="80" placeholder="e.g. Vintage wooden bookshelf"></label><div class="form-grid"><label>Category<select name="category">${['Home & living','Electronics','Clothing','Outdoors','Hobbies','Books'].map(c=>`<option>${c}</option>`).join('')}</select></label><label>Condition<select name="condition"><option>Good condition</option><option>Like new</option><option>Well loved</option></select></label><label>Location<input name="location" required placeholder="Neighborhood, city" maxlength="100"></label><label>Available from<input name="date" type="date" required></label><label>Size / dimensions<input name="size" required placeholder="e.g. 80 × 40 × 120 cm" maxlength="60"></label><label>Weight<input name="weight" required placeholder="e.g. 8 kg" maxlength="30"></label></div><label>Short description<input name="desc" required maxlength="150" placeholder="A quick introduction for your item card"></label><label>Full description<textarea name="long" required maxlength="4000" placeholder="The story, condition, and anything someone should know…"></textarea></label><label>What would you trade for?<input name="want" required maxlength="300" placeholder="A few things you’re looking for"></label><label>Photos (1–6)<input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required><span class="demo">Choose up to six JPG, PNG, or WebP images.</span></label><button class="primary">Upload item ↑</button><p class="demo" id="formMessage" role="status">Your listing and photos will be shared with everyone using TradeIt.</p></form>`);$('#listingForm').onsubmit=async e=>{e.preventDefault();const form=e.target,files=[...$('#photos').files],message=$('#formMessage'),btn=form.querySelector('button');if(files.length<1||files.length>6){message.textContent='Choose between one and six photos.';return}if(!tradeitDb){message.textContent='Database connection is not ready. Reload the page and try again.';return}btn.disabled=true;btn.textContent='Uploading…';const uploaded=[];try{const userId=await currentUserId();if(!userId)throw new Error('Please sign in before uploading an item.');const fields=Object.fromEntries(new FormData(form));const listingId=crypto.randomUUID();const imageUrls=[];for(let index=0;index<files.length;index++){const file=files[index];if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Only JPG, PNG, and WebP photos are supported.');const blob=await compressForUpload(file);if(blob.size>5*1024*1024)throw new Error('One of your photos is too large (maximum 5 MB).');const path=`${userId}/${listingId}/${index+1}.jpg`;const {error:uploadError}=await tradeitDb.storage.from('listing-images').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(uploadError)throw uploadError;uploaded.push(path);const {data:urlData}=tradeitDb.storage.from('listing-images').getPublicUrl(path);imageUrls.push(urlData.publicUrl)}const {error:insertError}=await tradeitDb.from('listings').insert({id:listingId,user_id:userId,title:fields.title,category:fields.category,item_condition:fields.condition,location:fields.location,available_from:fields.date,size:fields.size,weight:fields.weight,short_description:fields.desc,description:fields.long,trade_want:fields.want,images:imageUrls,owner_display:userId.slice(0,8),status:'available'});if(insertError)throw insertError;$('#modal').close();await loadSharedListings();openItem(listingId);toast('Your listing is live and visible to everyone!')}catch(error){console.error('Listing upload failed:',error);if(uploaded.length){const {error:cleanupError}=await tradeitDb.storage.from('listing-images').remove(uploaded);if(cleanupError)console.warn('Could not clean up uploaded photos:',cleanupError)}message.textContent=error?.message||'Could not upload your listing. Please try again.'}finally{btn.disabled=false;btn.textContent='Upload item ↑'}}}
function compressForUpload(file){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{try{const c=document.createElement('canvas'),r=Math.min(1,1200/img.width,1200/img.height);c.width=Math.max(1,Math.round(img.width*r));c.height=Math.max(1,Math.round(img.height*r));c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(blob=>{URL.revokeObjectURL(url);blob?resolve(blob):reject(new Error('Could not process photo.'))},'image/jpeg',.8)}catch(error){URL.revokeObjectURL(url);reject(error)}};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not read photo.'))};img.src=url})}
function compress(file){return new Promise((resolve,reject)=>{if(!['image/jpeg','image/png','image/webp'].includes(file.type)){reject(new Error('Unsupported image'));return}const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const c=document.createElement('canvas'),r=Math.min(1,1200/img.width,1200/img.height);c.width=img.width*r;c.height=img.height*r;c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',.8))};img.onerror=()=>{URL.revokeObjectURL(url);reject()};img.src=url})}

async function editListing(itemId) {
  try {
    const uid = await currentUserId();

    if (!uid) throw new Error('Please sign in first.');

    const { data: item, error } = await tradeitDb
      .from('listings')
      .select('*')
      .eq('id', itemId)
      .eq('user_id', uid)
      .single();

    if (error) throw error;

    if (item.status !== 'available') {
      throw new Error('Only available listings can be edited.');
    }

    $('#modal').dataset.title = 'Edit Listing — tradeit';

    modal(`
      <h2>Edit your listing</h2>
      <p>Update the details of your item.</p>

      <form id="editListingForm">
        <label>Item name
          <input name="title" required maxlength="80"
                 value="${esc(item.title)}">
        </label>

        <div class="form-grid">
          <label>Category
            <select name="category">
              ${['Home & living','Electronics','Clothing','Outdoors','Hobbies','Books']
                .map(c => `<option ${item.category === c ? 'selected' : ''}>${c}</option>`)
                .join('')}
            </select>
          </label>

          <label>Condition
            <select name="condition">
              ${['Good condition','Like new','Well loved']
                .map(c => `<option ${item.item_condition === c ? 'selected' : ''}>${c}</option>`)
                .join('')}
            </select>
          </label>

          <label>Location
            <input name="location" required maxlength="100"
                   value="${esc(item.location || '')}">
          </label>

          <label>Available from
            <input name="date" type="date" required
                   value="${esc(item.available_from || '')}">
          </label>

          <label>Size / dimensions
            <input name="size" required maxlength="60"
                   value="${esc(item.size || '')}">
          </label>

          <label>Weight
            <input name="weight" required maxlength="30"
                   value="${esc(item.weight || '')}">
          </label>
        </div>

        <label>Short description
          <input name="desc" required maxlength="150"
                 value="${esc(item.short_description || '')}">
        </label>

        <label>Full description
          <textarea name="long" required maxlength="4000">${esc(item.description || '')}</textarea>
        </label>

        <label>What would you trade for?
          <input name="want" required maxlength="300"
                 value="${esc(item.trade_want || '')}">
        </label>

        <button class="primary" type="submit">Save changes</button>
        <p id="editListingMessage" role="status"></p>
      </form>
    `);

    $('#editListingForm').onsubmit = async e => {
      e.preventDefault();

      const form = e.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const message = $('#editListingMessage');
      const fields = Object.fromEntries(new FormData(form));

      button.disabled = true;
      button.textContent = 'Saving...';

      try {
        const { data: updated, error: updateError } = await tradeitDb
          .from('listings')
          .update({
            title: fields.title,
            category: fields.category,
            item_condition: fields.condition,
            location: fields.location,
            available_from: fields.date,
            size: fields.size,
            weight: fields.weight,
            short_description: fields.desc,
            description: fields.long,
            trade_want: fields.want
          })
          .eq('id', itemId)
          .eq('user_id', uid)
          .eq('status', 'available')
          .select('id');

        if (updateError) throw updateError;

        if (!updated?.length) {
          throw new Error('Listing could not be updated. It may no longer be available.');
        }

        $('#modal').close();

        await loadSharedListings();

        const listingWindow = wins.get('item-' + itemId);

        if (listingWindow) {
          closeWindow('item-' + itemId);
        }

        openItem(itemId);

        toast('Listing updated successfully!');
      } catch (err) {
        message.textContent = err.message || 'Could not update listing.';
        button.disabled = false;
        button.textContent = 'Save changes';
      }
    };

  } catch (err) {
    toast(err.message || 'Could not open listing editor.');
  }
}
