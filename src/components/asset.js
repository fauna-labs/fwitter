import { Image, Video, Transformation } from 'cloudinary-react'
import React from 'react'
import PropTypes from 'prop-types'

const Asset = props => {
  const generateAsset = asset => {
    if (asset && asset.type === 'video') {
      return generateVideo(asset)
    } else if (asset && asset.type === 'image') {
      return generateImage(asset)
    } else {
      return null
    }
  }

  const generateImage = asset => {
    /* The "optimised" version is using the Cloudinary <Image /> Component. The props 
      added are fetch format and quality - by setting these to "auto" Cloudinary does 
      magical things: it will serve the best format for every browser (e.g. WebP for Chrome)
      and it will also reduce the quality to a level where it's not visible to the human eye

      This means the file now (in Chrome) is Content-Type: image/webp and it's ~ 32 KB!
      */
    const publicId = asset.id // name of image in Cloudinary
    const cloudName = asset.cloudName || process.env.REACT_APP_LOCAL___CLOUDINARY_CLOUDNAME // name of Cloudinary account

    return (
      <div className="fweet-asset">
        <Image publicId={publicId} cloudName={cloudName} fetchFormat="auto" quality="auto" secure="true" />
      </div>
    )
  }

  const generateVideo = asset => {
    const publicId = asset.id // name of image in Cloudinary
    const cloudName = asset.cloudName || process.env.REACT_APP_LOCAL___CLOUDINARY_CLOUDNAME // name of Cloudinary account

    return (
      /* Cloudinary has many options.
       * <Transformation audioCodec="none" would remove the sound, saving valueble kbs
       *
       * */
      <div className="fweet-asset">
        <Video playsInline autoPlay loop={true} controls={true} cloudName={cloudName} publicId={publicId}>
          <Transformation width="600" fetchFormat="auto" crop="scale" />
        </Video>
      </div>
    )
  }

  return generateAsset(props.asset)
}

Asset.propTypes = {
  asset: PropTypes.object
}

export default Asset
