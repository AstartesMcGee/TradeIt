function modal(html){$('#modalBody').innerHTML=html;$('#modal').showModal()}function legacyOffer(i){$('#modal').dataset.title='Trade proposal — tradeit';modal(`<h2>Make an offer.</h2><p>Propose a trade for ${esc(i.title)}.</p><p class="demo">This preview saves a trade draft on your device. It does not contact the owner.</p><form id="offerForm"><label>What would you like to offer?<input name="item" placeholder="e.g. My vintage record player" required maxlength="150"></label><label>A note about your trade<textarea name="message" placeholder="Tell them a little about your item…" required maxlength="2000"></textarea></label><button class="primary">Save trade draft ↗</button></form>`);$('#offerForm').onsubmit=e=>{e.preventDefault();let drafts=read('barter-drafts',[]);drafts.push({listing:i.id,...Object.fromEntries(new FormData(e.target)),created:new Date().toISOString()});localStorage.setItem('barter-drafts',JSON.stringify(drafts));$('#modal').close();toast('Trade draft saved in this browser.')}}
function listing(){$('#modal').dataset.title='Upload — tradeit';modal(`<span class="eyebrow">Make some room</span><h2>What are you trading?</h2><p>Add photos and details for the item you want to trade.</p><form id="listingForm"><label>Item name<input name="title" required maxlength="80" placeholder="e.g. Vintage wooden bookshelf"></label><div class="form-grid"><label>Category<select name="category">${['Home & living','Electronics','Clothing','Outdoors','Hobbies','Books'].map(c=>`<option>${c}</option>`).join('')}</select></label><label>Condition<select name="condition"><option>Good condition</option><option>Like new</option><option>Well loved</option></select></label><label>Location<input name="location" required placeholder="Neighborhood, city" maxlength="100"></label><label>Available from<input name="date" type="date" required></label><label>Size / dimensions<input name="size" required placeholder="e.g. 80 × 40 × 120 cm" maxlength="60"></label><label>Weight<input name="weight" required placeholder="e.g. 8 kg" maxlength="30"></label></div><label>Short description<input name="desc" required maxlength="150" placeholder="A quick introduction for your item card"></label><label>Full description<textarea name="long" required maxlength="4000" placeholder="The story, condition, and anything someone should know…"></textarea></label><label>What would you trade for?<input name="want" required maxlength="300" placeholder="A few things you’re looking for"></label><label>Photos (1–6)<input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required><span class="demo">Choose up to six JPG, PNG, or WebP images.</span></label><button class="primary">Upload item ↑</button><p class="demo" id="formMessage" role="status">Your listing and photos will be shared with everyone using TradeIt.</p></form>`);$('#listingForm').onsubmit=async e=>{e.preventDefault();const form=e.target,files=[...$('#photos').files],message=$('#formMessage'),btn=form.querySelector('button');if(files.length<1||files.length>6){message.textContent='Choose between one and six photos.';return}if(!tradeitDb){message.textContent='Database connection is not ready. Reload the page and try again.';return}btn.disabled=true;btn.textContent='Uploading…';const uploaded=[];try{const userId=await currentUserId();if(!userId)throw new Error('Please sign in before uploading an item.');const fields=Object.fromEntries(new FormData(form));const listingId=crypto.randomUUID();const imageUrls=[];for(let index=0;index<files.length;index++){const file=files[index];if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Only JPG, PNG, and WebP photos are supported.');const blob=await compressForUpload(file);if(blob.size>5*1024*1024)throw new Error('One of your photos is too large (maximum 5 MB).');const path=`${userId}/${listingId}/${index+1}.jpg`;const {error:uploadError}=await tradeitDb.storage.from('listing-images').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(uploadError)throw uploadError;uploaded.push(path);const {data:urlData}=tradeitDb.storage.from('listing-images').getPublicUrl(path);imageUrls.push(urlData.publicUrl)}const {error:insertError}=await tradeitDb.from('listings').insert({id:listingId,user_id:userId,title:fields.title,category:fields.category,item_condition:fields.condition,location:fields.location,available_from:fields.date,size:fields.size,weight:fields.weight,short_description:fields.desc,description:fields.long,trade_want:fields.want,images:imageUrls,owner_display:userId.slice(0,8),status:'available'});if(insertError)throw insertError;$('#modal').close();await loadSharedListings();openItem(listingId);toast('Your listing is live and visible to everyone!')}catch(error){console.error('Listing upload failed:',error);if(uploaded.length){const {error:cleanupError}=await tradeitDb.storage.from('listing-images').remove(uploaded);if(cleanupError)console.warn('Could not clean up uploaded photos:',cleanupError)}message.textContent=error?.message||'Could not upload your listing. Please try again.'}finally{btn.disabled=false;btn.textContent='Upload item ↑'}}}
function compressForUpload(file){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{try{const c=document.createElement('canvas'),r=Math.min(1,1200/img.width,1200/img.height);c.width=Math.max(1,Math.round(img.width*r));c.height=Math.max(1,Math.round(img.height*r));c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(blob=>{URL.revokeObjectURL(url);blob?resolve(blob):reject(new Error('Could not process photo.'))},'image/jpeg',.8)}catch(error){URL.revokeObjectURL(url);reject(error)}};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not read photo.'))};img.src=url})}
function compress(file){return new Promise((resolve,reject)=>{if(!['image/jpeg','image/png','image/webp'].includes(file.type)){reject(new Error('Unsupported image'));return}const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const c=document.createElement('canvas'),r=Math.min(1,1200/img.width,1200/img.height);c.width=img.width*r;c.height=img.height*r;c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',.8))};img.onerror=()=>{URL.revokeObjectURL(url);reject()};img.src=url})}

async function editListing(itemId) {
  try {
    if (!tradeitDb) throw new Error('Database is not connected.');

    const uid = await currentUserId();
    if (!uid) throw new Error('Please sign in first.');

    const { data: item, error } = await tradeitDb
      .from('listings')
      .select('*')
      .eq('id', itemId)
      .eq('user_id', uid)
      .single();

    if (error) throw error;

    if (!['available', 'unavailable'].includes(item.status)) {
      throw new Error('Reserved or traded listings cannot be edited.');
    }

    // Each entry is either an existing URL or a newly selected File.
    let photos = (item.images || []).map(url => ({
      id: crypto.randomUUID(),
      url,
      file: null,
      preview: url
    }));

    if (!photos.length) {
      throw new Error('This listing has no photos to edit.');
    }

    const originalUrls = [...(item.images || [])];
    const temporaryPreviews = new Set();
    let saving = false;

    const makePhoto = file => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new Error('Only JPG, PNG, and WebP photos are supported.');
      }

      const preview = URL.createObjectURL(file);
      temporaryPreviews.add(preview);

      return {
        id: crypto.randomUUID(),
        url: null,
        file,
        preview
      };
    };

    const cleanupPreviews = () => {
      temporaryPreviews.forEach(url => URL.revokeObjectURL(url));
      temporaryPreviews.clear();
    };

    // Convert a public Storage URL back into its object path.
    const storagePath = url => {
      try {
        const parsed = new URL(url);
        const marker = '/storage/v1/object/public/listing-images/';
        const position = parsed.pathname.indexOf(marker);

        if (position === -1) return null;

        const path = decodeURIComponent(
          parsed.pathname.slice(position + marker.length)
        );

        // Never delete anything outside this listing's folder.
        const prefix = `${uid}/${itemId}/`;

        return path.startsWith(prefix) ? path : null;
      } catch {
        return null;
      }
    };

    $('#modal').dataset.title = 'Edit Listing — tradeit';

    modal(`
      <h2>Edit your listing</h2>
      <p>Update the details and photos of your item.</p>

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

        <div class="photo-editor">
          <h3>Listing photos</h3>
          <p class="demo">
            Keep 1–6 photos. The first photo is the marketplace thumbnail.
            Changes are applied when you save.
          </p>

          <div id="editPhotoGallery"></div>

          <label>
            Add photos
            <input
              id="editAddPhotos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
            >
          </label>

          <input
            id="editReplacePhoto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
          >

          <p class="demo" id="editPhotoCount"></p>
        </div>

        <button class="primary" type="submit">Save changes</button>
        <p id="editListingMessage" role="status"></p>
      </form>
    `);

    const form = $('#editListingForm');
    const gallery = $('#editPhotoGallery');
    const message = $('#editListingMessage');
    const addInput = $('#editAddPhotos');
    const replaceInput = $('#editReplacePhoto');

    let replacementId = null;

    const renderPhotos = () => {
      $('#editPhotoCount').textContent =
        `${photos.length} of 6 photos selected`;

      gallery.innerHTML = `
        <div style="
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(145px,1fr));
          gap:12px;
          margin:12px 0 18px;
        ">
          ${photos.map((photo, index) => `
            <div style="
              padding:8px;
              border:1px solid #8ba6c8;
              border-radius:5px;
              background:#eef5ff;
              color:#243b60;
              text-align:center;
            ">
              <img
                src="${esc(photo.preview)}"
                alt="Photo ${index + 1}"
                style="
                  width:100%;
                  height:115px;
                  object-fit:cover;
                  border-radius:3px;
                  display:block;
                  margin-bottom:7px;
                "
              >

              <strong style="font-size:12px;">
                Photo ${index + 1}
                ${index === 0 ? ' · Cover' : ''}
              </strong>

              <div style="
                display:flex;
                flex-wrap:wrap;
                gap:4px;
                justify-content:center;
                margin-top:8px;
              ">
                <button type="button" class="xp-button"
                  data-photo-move="${esc(photo.id)}"
                  data-direction="-1"
                  ${index === 0 ? 'disabled' : ''}
                  title="Move left">←</button>

                <button type="button" class="xp-button"
                  data-photo-move="${esc(photo.id)}"
                  data-direction="1"
                  ${index === photos.length - 1 ? 'disabled' : ''}
                  title="Move right">→</button>

                <button type="button" class="xp-button"
                  data-photo-replace="${esc(photo.id)}">
                  Replace
                </button>

                <button type="button" class="xp-button"
                  data-photo-remove="${esc(photo.id)}"
                  ${photos.length === 1 ? 'disabled' : ''}>
                  Remove
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      gallery.querySelectorAll('[data-photo-move]').forEach(button => {
        button.onclick = () => {
          const index = photos.findIndex(
            p => p.id === button.dataset.photoMove
          );
          const next = index + Number(button.dataset.direction);

          if (index < 0 || next < 0 || next >= photos.length) return;

          [photos[index], photos[next]] = [photos[next], photos[index]];
          renderPhotos();
        };
      });

      gallery.querySelectorAll('[data-photo-remove]').forEach(button => {
        button.onclick = () => {
          if (photos.length <= 1) return;

          photos = photos.filter(
            p => p.id !== button.dataset.photoRemove
          );

          renderPhotos();
        };
      });

      gallery.querySelectorAll('[data-photo-replace]').forEach(button => {
        button.onclick = () => {
          replacementId = button.dataset.photoReplace;
          replaceInput.value = '';
          replaceInput.click();
        };
      });
    };

    addInput.onchange = () => {
      try {
        const files = [...addInput.files];

        if (photos.length + files.length > 6) {
          throw new Error('A listing can have at most six photos.');
        }

        const newPhotos = files.map(makePhoto);
        photos.push(...newPhotos);

        message.textContent = '';
        renderPhotos();
      } catch (err) {
        message.textContent = err.message;
      } finally {
        addInput.value = '';
      }
    };

    replaceInput.onchange = () => {
      try {
        const file = replaceInput.files[0];
        if (!file || !replacementId) return;

        const index = photos.findIndex(p => p.id === replacementId);
        if (index < 0) return;

        photos[index] = makePhoto(file);

        message.textContent = '';
        renderPhotos();
      } catch (err) {
        message.textContent = err.message;
      } finally {
        replaceInput.value = '';
        replacementId = null;
      }
    };

    renderPhotos();

    form.onsubmit = async e => {
      e.preventDefault();

      if (saving) return;
      saving = true;

      const button = form.querySelector('button[type="submit"]');
      const fields = Object.fromEntries(new FormData(form));
      const uploadedPaths = [];

      button.disabled = true;
      button.textContent = 'Saving...';
      message.textContent = '';

      try {
        if (photos.length < 1 || photos.length > 6) {
          throw new Error('A listing must have between one and six photos.');
        }

        // Check that the listing is still available.
        const { data: latest, error:latestError } = await tradeitDb
          .from('listings')
          .select('status')
          .eq('id', itemId)
          .eq('user_id', uid)
          .single();

        if (latestError) throw latestError;

        if (!['available', 'unavailable'].includes(latest.status)) {
          throw new Error('This listing can no longer be edited.');
        }

        const imageUrls = [];

        for (const photo of photos) {
          if (!photo.file) {
            imageUrls.push(photo.url);
            continue;
          }

          const blob = await compressForUpload(photo.file);

          if (blob.size > 5 * 1024 * 1024) {
            throw new Error('A photo exceeds the 5 MB upload limit.');
          }

          // Unique paths prevent overwriting existing images.
          const path = `${uid}/${itemId}/${crypto.randomUUID()}.jpg`;

          const { error: uploadError } = await tradeitDb.storage
            .from('listing-images')
            .upload(path, blob, {
              contentType: 'image/jpeg',
              upsert: false
            });

          if (uploadError) throw uploadError;

          uploadedPaths.push(path);

          const { data: urlData } = tradeitDb.storage
            .from('listing-images')
            .getPublicUrl(path);

          imageUrls.push(urlData.publicUrl);
        }

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
            trade_want: fields.want,
            images: imageUrls
          })
          .eq('id', itemId)
          .eq('user_id', uid)
          .eq('status', latest.status)
          .select('id');

        if (updateError) throw updateError;

        if (!updated?.length) {
          throw new Error('Listing could not be updated.');
        }

        // The listing has been saved successfully.
        // Do not roll back newly uploaded photos after this point.
        const removedUrls = originalUrls.filter(
          url => !imageUrls.includes(url)
        );

        const removedPaths = removedUrls
          .map(storagePath)
          .filter(Boolean);

        if (removedPaths.length) {
          const { error: cleanupError } = await tradeitDb.storage
            .from('listing-images')
            .remove(removedPaths);

          if (cleanupError) {
            console.warn('Old photo cleanup failed:', cleanupError);
          }
        }

        cleanupPreviews();
        $('#modal').close();

        await loadSharedListings();

        if (wins.has('item-' + itemId)) {
          closeWindow('item-' + itemId);
        }

        openItem(itemId);
        toast('Listing and photos updated successfully!');

      } catch (err) {
        console.error('Listing edit failed:', err);

        // Only remove newly uploaded files if the database save failed.
        // Check whether the listing already references them before cleanup.
        if (uploadedPaths.length) {
          try {
            const { data: current } = await tradeitDb
              .from('listings')
              .select('images')
              .eq('id', itemId)
              .single();

            const currentImages = current?.images || [];

            const safeToRemove = uploadedPaths.filter(path => {
              const { data } = tradeitDb.storage
                .from('listing-images')
                .getPublicUrl(path);

              return !currentImages.includes(data.publicUrl);
            });

            if (safeToRemove.length) {
              await tradeitDb.storage
                .from('listing-images')
                .remove(safeToRemove);
            }
          } catch (cleanupError) {
            console.warn('Upload cleanup could not complete:', cleanupError);
          }
        }

        message.textContent =
          err.message || 'Could not save your listing.';

      } finally {
        saving = false;
        button.disabled = false;
        button.textContent = 'Save changes';
      }
    };

  } catch (err) {
    toast(err.message || 'Could not open listing editor.');
  }
}
